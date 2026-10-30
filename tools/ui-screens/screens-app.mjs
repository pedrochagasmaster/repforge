/**
 * Drive the non-onboarding surfaces.
 *
 * Every scenario is self-contained: it starts from the seeded catalog program
 * and navigates to its own subject. The previous tool walked one long-lived
 * page through all 35 screens in order, so a single broken step silently
 * poisoned every frame after it.
 */
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgramLab } from "../build-programlab.mjs";
import { maybeStartLocalPreview } from "../local-preview.mjs";
import { catalogState, directionDState, emptyEntryState, localeState } from "./fixtures.mjs";
import { CAPTURE_NOW, dismissChrome, LOG_DRAFT, replayGuide, seed, sleep } from "./session.mjs";
import { definitionSlot, installGeneratedProgram, isWeightRepsSlot, metricLogRow } from "../../test/fixtures/history-metric-rows.mjs";
import { openShelfField } from "../../test/browser.mjs";
import { DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID } from "./direction-d-canonical-fixture.generated.mjs";

const WHY_DATA = new URL("../../plans/067/data/", import.meta.url);
const WHY_GYM = JSON.parse(readFileSync(new URL("gym.json", WHY_DATA), "utf8"));
const WHY_OBSERVATIONS = JSON.parse(readFileSync(new URL("programs.json", WHY_DATA), "utf8"));
const WHY_CATALOG = JSON.parse(readFileSync(new URL("app_file.json", WHY_DATA), "utf8"));
const WHY_OBSERVED_IDS = [...new Set(Object.values(WHY_OBSERVATIONS).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const WHY_REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: WHY_GYM.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(WHY_OBSERVED_IDS.map((id) =>
    [id, [...WHY_CATALOG.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

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
          size: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
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
        rows: new Set(labels.map((label) => Math.round(label.rect.top))).size,
        height: navRect.height,
        expectedLabels,
        labels,
        overlap,
        dockInViewport: navRect.left >= 0 && navRect.right <= root.clientWidth
          && navRect.top >= 0 && navRect.bottom <= root.clientHeight,
      };
    });
    if (layout.error || layout.rootFontSize !== "32px" || layout.rootInlineFontSize !== ""
      || layout.columns !== 4 || layout.rows !== 1 || Math.abs(layout.height - 62) > 0.5 || layout.labels.length !== 4
      || layout.labels.some((label, index) => !label.visible || !label.fits || label.size > 14.3 || label.text !== layout.expectedLabels[index])
      || layout.overlap || !layout.dockInViewport) {
      throw new Error(`The production dock does not keep one row of capped labels for an external 32px root font: ${JSON.stringify(layout)}`);
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

/** #317: a squat slot's chosen alternates, 45° leg press then hack squat. */
const SQUAT_ALTERNATES = Object.freeze(["1a25c6f170d88079a926dde776766181", "1a25c6f170d88008a9adde9f71881c36"]);
/** Catalog states built on the Direction D fixture; each R3 sub-slice adds its own. */
const D_FIXTURE_STATES = new Set([
  "workout/focus", "workout/focus-glossary", "workout/correction", // R3c
  "workout/logged-sets", // #517: the logged sets shown in place, the rest running
  "workout/logged-sets-folded", // #517: a banner shortens the window and the oldest logged set folds
  "workout/deload-week", // Plan 072 S4: the deload cue in Focus
  "workout/session", "workout/early-finish", "workout/exercise-note", "workout/warmup-actions", // R3d
  "workout/reorder", "workout/skipped-actions", "workout/substituted-actions", // R3d
  "workout/actions", "workout/exercise-actions", // R3x: the redrawn sheet, on the lifter the drawing shows
  "workout/swap-alternates", // #317: the swap picker leads with the squat slot's alternates
  "workout/abandon", "workout/swap-reason", // Plan 071 §10: end-without-saving and the swap reason chips
  "history/list", "history/list-scrolled", "history/session", "history/edit-dirty", "history/edit-invalid", // R3j, R3j2
  "program/overview", // R3k
  "today/done", // R3x: the finished day, on the lifter whose Monday session is in the log
  "today/deload-week", // Plan 072 S4: the deload cue in Today
  "today/draft-resume", // R3b2: the unfinished-session band, on the same lifter as Today
  "today/in-progress", // Option A (owner, 2026-10-23): the live card and each lift's state, on the same lifter
  "progress/minibar", "history/minibar-rest", "program/minibar-rest-done", // the mini bar (owner addendum, 2026-10-23)
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
  "today/skipped", "today/context-menu", "today/ready", "today/dock-viewer", "today/ready-scrolled", "today/day-picker", "today/rest-bar", "today/draft-resume",
  "today/in-progress", "progress/minibar", "history/minibar-rest", "program/minibar-rest-done",
  "workout/why-this-weight", "workout/why-in-session",
  "workout/rest-running", "workout/rest-done", "workout/rest-sheet", "workout/rest-sheet-idle",
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
  "today/deload-week": CAPTURE_NOW,
  "workout/deload-week": CAPTURE_NOW,
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
  if (key === "history/per-side-session" || key === "workout/focus-per-side") return emptyEntryState(lang);
  if (key === "workout/why-setup") return emptyEntryState(lang);
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
    if (key === "history/session") {
      // #515: the session the page opens (the newest) has a recorded duration.
      const newest = [...drawn.log].sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
      const completedAt = new Date(Date.parse(newest.created)).toISOString();
      drawn.sessionTiming = { [String(newest.session)]: { startedAt: new Date(Date.parse(completedAt) - 3120000).toISOString(),
        completedAt, durationSeconds: 3120 } };
    }
    if (key === "workout/swap-alternates") {
      const slot = drawn.programMeta.programDefinition.days.flatMap((day) => day.slots).find((entry) => entry.id === "ex-sq");
      slot.alternates = [...SQUAT_ALTERNATES];
    }
    if (key === "today/deload-week" || key === "workout/deload-week") {
      const cycles = drawn.programMeta.programDefinition.cycles;
      drawn.programMeta.programDefinition.deloadCycles = [cycles];
      drawn.programMeta.mesocycleLengthWeeks = cycles;
      drawn.programMeta.started = isoDaysAgo((cycles - 1) * 7);
      drawn.programMeta.mesocycleStatus = "active";
      drawn.log = drawn.log.filter(row => String(row.date) < CAPTURE_NOW.slice(0, 10));
    }
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
  if (["program/progression-editor","program/editor-context-menu"].includes(key) || ["program/editor-alternates","program/editor-alternate-context-menu"].includes(key) || key === "program/editor-suggest-loads") {
    const kept = new Set(["seed-ex-1", "seed-ex-2"]);
    state.program = state.program.filter((exercise) => exercise.day !== "Day 1" || kept.has(exercise.id));
    for (const day of state.programMeta.programDefinition.days) {
      if (day.name === "Day 1") day.slots = day.slots.filter((slot) => kept.has(slot.id));
    }
  }
  if (["program/editor-alternates","program/editor-alternate-context-menu"].includes(key)) {
    const slot = state.programMeta.programDefinition.days.flatMap((day) => day.slots).find((entry) => entry.id === "seed-ex-1");
    // The seed slot is itself a hack squat, so its list is leg press then a split squat.
    slot.alternates = [SQUAT_ALTERNATES[0], "1a25c6f170d8809eb8a5e76ff245649d"];
  }
  return localeState(state, lang);
}

/* Plan 074: the installed editor (candidate A) and its exercise sheet. */
async function editorIdleA(page) {
  await page.waitForSelector('#programEditor [data-role="editor"][data-layout="review"]:not([aria-busy="true"])', { timeout: 20000 });
}
/** The editor's page sheet, open and at rest. A row clicked while the sheet is still sliding up can look out of view,
 *  so the click scrolls the sheet first; at rest it does not. Clicking only once the sheet is in place keeps the
 *  sheet's scroll offset the same in every run (the strict catalog verify saw it move under the exercise sheet). */
async function openEditorA(page) {
  await page.click("#programEditToggle");
  await editorIdleA(page);
  await editorSheetAtRest(page);
}
async function editorSheetAtRest(page) {
  await page.waitForFunction(() => {
    const sheet = document.querySelector('#program.sheet.is-open');
    if (!sheet) return false;
    const style = getComputedStyle(sheet), position = new DOMMatrixReadOnly(style.transform);
    return position.m41 === 0 && position.m42 === 0 && style.opacity === '1'
      && sheet.getAnimations().every(animation => animation.playState !== 'running');
  });
}
async function editorRowMenuForCapture(page, selector) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  const button = page.locator(selector).first();
  await button.evaluate(element => {
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  });
  // A row whose ⋯ is shown only to keyboard focus opens through its context gesture, as a person would.
  if (await button.evaluate(element => element.classList.contains('visually-hidden'))) {
    await page.locator(selector).first().locator('xpath=ancestor::*[@data-context-row][1]').click({ button: 'right' });
  } else await button.click();
  await page.waitForSelector('#nativeContextMenu[open]');
}
/** The exercise sheet over the editor, at rest: the sheet in place with no animation running, and every scroller
 *  under it (the editor's page sheet among them) unchanged for three frames. Opening the row can scroll the page
 *  sheet behind it, and a fixed wait let that scroll land at a different offset from run to run, so the strict catalog
 *  verify saw the underlay move (program/editor-suggest-loads, editor-alternates). */
async function openEditorSheetA(page, id) {
  await page.locator(`#programEditor [data-role="exercise-row"][data-id="${id}"]`).click();
  await page.waitForSelector(`#reviewSheet.is-open [data-pe-sheet="exercise"][data-id="${id}"]`, { timeout: 20000 });
  await page.waitForFunction(() => {
    const sheet = document.querySelector("#reviewSheet.is-open");
    if (!sheet) return false;
    const position = new DOMMatrixReadOnly(getComputedStyle(sheet).transform);
    return position.m42 === 0 && document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity);
  }, undefined, { timeout: 20000 });
  await page.evaluate(() => new Promise((resolve) => {
    const offsets = () => [document.scrollingElement, ...document.querySelectorAll("*")]
      .filter((el) => el && el.scrollHeight > el.clientHeight).map((el) => `${el.scrollTop},${el.scrollLeft}`).join("|");
    let last = offsets(), still = 0;
    const tick = () => {
      const now = offsets();
      still = now === last ? still + 1 : 0; last = now;
      if (still >= 3) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
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

/** Focus on the program's first day. Boot now defaults to the day after the last one trained (#528), so a state that
 *  depicts the first lift of a session names its day instead of inheriting whichever day the fixture's history implies. */
async function focusMode(page) {
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").program?.[0]?.day || null);
  await enterWorkout(page, first ? { day: first } : {});
}

async function openTransferState(page, state) {
  await page.evaluate((name) => window.__repforgeUi.openInstallTransferState(name), state);
  await page.waitForSelector(`#iosInstallSheet[data-transfer-state="${state}"].is-open`, { timeout: 10000 });
  await sleep(page, 300);
}

/** Today's open session for the live card and the mini bar: one lift done, one part done, one skipped and the next
 *  selected, made with the draft's own commands. Leaves the lifter in Focus. */
async function openSessionShape(page) {
  await focusMode(page);
  await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft, ids = api.current().exerciseOrder.slice();
    const working = (id) => api.current().exercises[id].setOrder.filter((setId) => api.current().exercises[id].sets[setId].role !== "warmup");
    const complete = async (id, setId) => {
      const set = api.current().exercises[id].sets[setId];
      if (Array.isArray(set.programmed.metrics)) {
        for (const metric of set.programmed.metrics) {
          const value = /rep/i.test(metric.semantic || "") ? "8" : /time|duration|second/i.test(metric.semantic || "") ? "45" : "60";
          await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: metric.id, value });
        }
      } else {
        await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "load", value: "60" });
        await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "reps", value: "8" });
      }
      await api.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
    };
    for (const setId of working(ids[0])) await complete(ids[0], setId);
    await complete(ids[1], working(ids[1])[0]);
    await api.dispatch("skipExercise", { exerciseInstanceId: ids[2] });
    await api.dispatch("selectExercise", { exerciseInstanceId: ids[3] });
    await api.flush();
  });
}

/** The open session, then a root tab other than Today, where the mini bar stands above the dock. */
async function miniBarOn(page, view) {
  await openSessionShape(page);
  await page.click("#leaveWorkout");
  await page.waitForSelector("#todayLive .today-live", { timeout: 20000 });
  await page.click(`nav button[data-view="${view}"]`);
  await page.waitForSelector("#miniBar:not(.hidden)", { timeout: 20000 });
}

/** Fill the current focus card and save the set, which starts the rest timer. */
/** #517: the table folds its oldest logged rows only when they do not fit; open the disclosure when it folds any. */
async function openFoldedSets(page) {
  const more = page.locator("#workout .exercise.is-current [data-ledgermore][aria-expanded='false']:not([hidden])");
  if (await more.count()) await more.click();
  await page.waitForFunction(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    return !!card?.querySelector("[data-editn]:not([hidden])") && !card.querySelector(".ledger__rows")?.style.height;
  }, undefined, { timeout: 5000 });
}
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

const PER_SIDE_READING_EXERCISES = Object.freeze({
  unilateral: "1a55c6f170d88031b658c6e278a82a88",
  bilateral: "1a05c6f170d8803ba48ec1443eab5978",
});
const PER_SIDE_LOAD_METRIC = "25a5c6f170d880e2990fc88146f7de56";
const PER_SIDE_MODE_MISSING_EXERCISE = "3895c6f170d88002b51fdf96c7dc50e1";

async function startExerciseChartViewportTracking(page) {
  await page.evaluate(() => {
    const events = [];
    const active = new Map();
    const seen = new WeakSet();
    const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: round(box.x), y: round(box.y), top: round(box.top), right: round(box.right),
        bottom: round(box.bottom), left: round(box.left), width: round(box.width), height: round(box.height) };
    };
    const ownerFor = event => event.target === document || event.target === window
      || event.target === document.scrollingElement ? "document" : event.target?.id || event.target?.tagName || "unknown";
    const record = (kind, event) => {
      if (seen.has(event)) return;
      seen.add(event);
      const owner = ownerFor(event);
      if (kind === "scroll") active.set(owner, true);
      else active.delete(owner);
      events.push({ kind, owner, at: round(performance.now()), windowY: round(window.scrollY),
        documentY: round(document.scrollingElement?.scrollTop || 0) });
    };
    const onScroll = event => record("scroll", event);
    const onScrollEnd = event => record("scrollend", event);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("scrollend", onScrollEnd, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd, { passive: true });

    const snapshot = () => {
      const metric = document.querySelector('#exDetail [data-metric="e1rm"]');
      const metricGroup = metric?.closest(".segpill");
      const plot = document.querySelector("#exDetail .exchart__plot");
      const readout = document.querySelector("#exDetail .exchart__readout");
      const viewport = { width: round(document.documentElement.clientWidth), height: round(document.documentElement.clientHeight) };
      const metricRect = rect(metricGroup), plotRect = rect(plot), readoutRect = rect(readout);
      return {
        route: { activeView: document.querySelector(".view.active")?.id || null,
          exercise: document.querySelector("#exercise")?.classList.contains("exview--chart") || false,
          pushing: document.body.classList.contains("is-pushing") },
        scroll: { windowY: round(window.scrollY), documentY: round(document.scrollingElement?.scrollTop || 0) },
        metricSelected: metric?.getAttribute("aria-pressed") === "true",
        viewport,
        geometry: { metricGroup: metricRect, plot: plotRect, readout: readoutRect,
          plotWithinViewport: !!(plotRect && plotRect.top >= -1 && plotRect.bottom <= viewport.height + 1),
          readoutWithinViewport: !!(readoutRect && readoutRect.top >= -1 && readoutRect.bottom <= viewport.height + 1) },
      };
    };
    const tracker = {
      events, active, snapshot, routeSettled: null, metricSettled: null, viewportDecision: null, settled: null, captured: null,
      report: () => ({ routeSettled: tracker.routeSettled, metricSettled: tracker.metricSettled, viewportDecision: tracker.viewportDecision,
        settled: tracker.settled, captured: tracker.captured || snapshot(),
        pendingScrollOwners: [...active.keys()], scrollEventCount: events.length, scrollEvents: events }),
      stop: () => {
        document.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("scrollend", onScrollEnd, true);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("scrollend", onScrollEnd);
        delete window.__exerciseChartViewport;
      },
    };
    window.__exerciseChartViewport = tracker;
  });
}

async function waitForExerciseChartRoute(page) {
  const result = await page.evaluate(() => new Promise(resolve => {
    const tracker = window.__exerciseChartViewport;
    const started = performance.now();
    const timeoutMs = 10000;
    let prior = "";
    let stableFrames = 0;
    let last = null;
    const tick = () => {
      last = tracker?.snapshot();
      const routeReady = last?.route.activeView === "exercise" && last.route.exercise && !last.route.pushing;
      const plotReady = !!last?.geometry.plot?.width && !!last.geometry.plot?.height;
      const ready = !!tracker && routeReady && plotReady && tracker.active.size === 0;
      const signature = ready ? JSON.stringify(last) : "";
      stableFrames = ready && signature === prior ? stableFrames + 1 : ready ? 1 : 0;
      prior = signature;
      if (ready && stableFrames >= 3) {
        tracker.routeSettled = { ...last, stableFrames, scrollEventCount: tracker.events.length,
          scrollCompletion: tracker.events.length ? "scrollend" : "no-scroll" };
        resolve({ ok: true, ...tracker.routeSettled });
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        resolve({ ok: false, timeoutMs, snapshot: last,
          activeOwners: [...(tracker?.active?.keys() || [])], scrollEvents: tracker?.events || [] });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  if (!result?.ok) throw new Error(`Exercise route viewport did not settle: ${JSON.stringify(result)}`);
  return result;
}

async function waitForExerciseChartMetric(page) {
  const result = await page.evaluate(() => new Promise(resolve => {
    const tracker = window.__exerciseChartViewport;
    const started = performance.now();
    const timeoutMs = 10000;
    let prior = "";
    let stableFrames = 0;
    let last = null;
    const tick = () => {
      last = tracker?.snapshot();
      const routeReady = last?.route.activeView === "exercise" && last.route.exercise && !last.route.pushing;
      const metricReady = last?.metricSelected && !!last.geometry.plot?.width && !!last.geometry.readout?.width;
      const ready = !!tracker && routeReady && metricReady && tracker.active.size === 0;
      const signature = ready ? JSON.stringify(last) : "";
      stableFrames = ready && signature === prior ? stableFrames + 1 : ready ? 1 : 0;
      prior = signature;
      if (ready && stableFrames >= 3) {
        tracker.metricSettled = { ...last, stableFrames, scrollEventCount: tracker.events.length,
          scrollCompletion: tracker.events.length ? "scrollend" : "no-scroll" };
        resolve({ ok: true, ...tracker.metricSettled });
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        resolve({ ok: false, timeoutMs, snapshot: last,
          activeOwners: [...(tracker?.active?.keys() || [])], scrollEvents: tracker?.events || [] });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  if (!result?.ok) throw new Error(`Exercise chart metric did not settle: ${JSON.stringify(result)}`);
  return result;
}

async function waitForExerciseChartViewport(page, { chartFocused }) {
  const result = await page.evaluate(({ chartFocused: expectFocusedChart }) => new Promise(resolve => {
    const tracker = window.__exerciseChartViewport;
    const started = performance.now();
    const timeoutMs = 10000;
    let prior = "";
    let stableFrames = 0;
    let last = null;
    const tick = () => {
      last = tracker?.snapshot();
      const routeReady = last?.route.activeView === "exercise" && last.route.exercise && !last.route.pushing;
      const groupReady = expectFocusedChart
        ? Math.abs(last?.geometry.metricGroup?.top ?? Infinity) <= 1
        : Math.abs(last?.scroll.windowY ?? Infinity) <= 1;
      const chartReady = last?.metricSelected && !!last.geometry.plot?.width && !!last.geometry.plot?.height
        && (!expectFocusedChart || (last.geometry.plotWithinViewport && last.geometry.readoutWithinViewport));
      const ready = !!tracker && routeReady && groupReady && chartReady && tracker.active.size === 0;
      const signature = ready ? JSON.stringify(last) : "";
      stableFrames = ready && signature === prior ? stableFrames + 1 : ready ? 1 : 0;
      prior = signature;
      if (ready && stableFrames >= 3) {
        tracker.settled = { ...last, stableFrames, scrollEventCount: tracker.events.length,
          scrollCompletion: tracker.events.length ? "scrollend" : "no-scroll" };
        resolve({ ok: true, ...tracker.settled });
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        resolve({ ok: false, timeoutMs, snapshot: last,
          activeOwners: [...(tracker?.active?.keys() || [])], scrollEvents: tracker?.events || [] });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { chartFocused });
  if (!result?.ok) throw new Error(`Exercise chart viewport did not settle: ${JSON.stringify(result)}`);
  return result;
}

async function installPerSideHistory(page, { bodyweightAssumption = false } = {}) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.() &&
    typeof window.__repforgeFinalizeProgramSetup === "function", undefined, { timeout: 15000 });
  const state = await page.evaluate(async ({ rowId, pressId }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 2,
      sessionMinutes: 90, environment: { kind: "commercial_gym" }, mustHaveExercises: [rowId, pressId],
    }, catalog);
    if (!mapped.ok) throw new Error(`Per-side catalog program request failed: ${JSON.stringify(mapped.conflicts)}`);
    const generated = window.RepForgeProgramCompiler.generateProgram(mapped.value, catalog);
    if (!generated.ok) throw new Error(`Per-side catalog program generation failed: ${JSON.stringify(generated.conflicts)}`);
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value, name: "Per-side history", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "p069-s2-per-side-reading" },
    });
    await window.__repforgeStorage.flush();
    return JSON.parse(localStorage.getItem("repforge_v1") || "{}");
  }, { rowId: PER_SIDE_READING_EXERCISES.unilateral, pressId: PER_SIDE_READING_EXERCISES.bilateral });

  const rows = state.program.filter(row => Object.values(PER_SIDE_READING_EXERCISES).includes(row.libraryId));
  if (rows.length !== 2 || rows[0].day !== rows[1].day) {
    throw new Error("Per-side catalog program did not place both readings on one day");
  }
  const rowFor = (programRow, session, date, values) => {
    const slot = definitionSlot(state.programMeta, programRow);
    const definitions = structuredClone(slot.metricDefinitions);
    const useBodyweight = bodyweightAssumption && programRow.libraryId === PER_SIDE_READING_EXERCISES.bilateral;
    const loadingConvention = slot.loadingModel?.loadingConvention ||
      (definitions.some(metric => metric.semantic === "loadPerSideKg" || metric.semantic === "persistentLoadPerSideKg")
        ? "per_side" : "external");
    const externalLoadMultiplier = loadingConvention === "per_side" ? (useBodyweight ? 2 : null)
      : loadingConvention === "bodyweight" ? 0 : 1;
    return {
      session, date, day: programRow.day, name: programRow.name, exerciseId: programRow.id,
      slotId: programRow.slotId || programRow.id, set: 1, setIndex: 0,
      load: values.loadKg ?? null, reps: values.reps ?? null, rir: 1,
      notes: "", created: `${date}T12:00:00.000Z`, primary: programRow.primary, secondary: programRow.secondary,
      performedName: programRow.name, performedPrimary: programRow.primary, performedSecondary: programRow.secondary,
      metricIds: [...slot.metricIds], metricDefinitions: definitions, metricOrigin: slot.metricOrigin || "source_catalog",
      metricValues: definitions.map(metric => ({ metricId: metric.id, value: values[metric.semantic], unit: metric.unit })),
      equipmentId: null, ...(slot.loadingModel ? { loadingModel: structuredClone(slot.loadingModel) } : {}),
      loadingConvention, ...(useBodyweight ? { bodyweight: 80 } : {}), loadingContext: {
        bodyweightContributionEnabled: useBodyweight, externalLoadMultiplier,
        bodyweightCoefficient: slot.loadingModel?.bodyweightCoefficient ?? null,
        loadingConvention, bodyweightKg: useBodyweight ? 80 : null,
      }, metricType: "source_metrics@1", restSeconds: null,
      performedLibraryId: slot.exerciseId, sourceLibraryId: slot.exerciseId,
      ...(state.programMeta.blockId ? { blockId: state.programMeta.blockId } : {}),
    };
  };
  const earlierDate = isoDaysAgo(7), latestDate = isoDaysAgo(1);
  const unilateral = rows.find(row => row.libraryId === PER_SIDE_READING_EXERCISES.unilateral);
  const bilateral = rows.find(row => row.libraryId === PER_SIDE_READING_EXERCISES.bilateral);
  state.programMeta.started = isoDaysAgo(21);
  state.log = [
    rowFor(unilateral, "per-side-history-earlier", earlierDate, { loadKg: 20, repsPerSide: 8 }),
    rowFor(bilateral, "per-side-history-earlier", earlierDate, { loadPerSideKg: 25, repsPerSide: 8 }),
    rowFor(unilateral, "per-side-history-latest", latestDate, { loadKg: 20, repsPerSide: 8 }),
    rowFor(bilateral, "per-side-history-latest", latestDate, { loadPerSideKg: 27.5, repsPerSide: 8 }),
  ];
  const valid = await page.evaluate(snapshot => window.__repforgeValidateStateShape(snapshot), state);
  if (!valid) {
    const diagnostics = await page.evaluate(snapshot => snapshot.log.map(row => {
      const definitions = window.RepForgeExerciseMetrics.validateDefinitions(row.metricIds, row.metricDefinitions);
      const values = window.RepForgeExerciseMetrics.validateMetricValues(row.metricIds, row.metricValues);
      const sourceBinding = window.RepForgeExerciseMetrics.validateExerciseSourceBinding({
        metricOrigin: row.metricOrigin, metricIds: row.metricIds, metricDefinitions: row.metricDefinitions,
        sourceId: row.sourceLibraryId, sourceExercise: window.RepForgeExerciseCatalog.snapshot().exercises.find(entry => entry.id === row.sourceLibraryId),
        bodyweightCoefficient: row.loadingModel?.bodyweightCoefficient ?? null,
      });
      const loading = window.RepForgeWorkoutDraft.validateLoadingContext(row.loadingContext);
      const load = row.metricDefinitions.find(metric => metric.semantic === "loadKg");
      const reps = row.metricDefinitions.find(metric => metric.semantic === "reps");
      return {
        session: row.session,
        definitionIssues: definitions.issues,
        valueIssues: values.issues,
        sourceIssues: sourceBinding.issues,
        loadingIssues: loading.issues,
        loadField: { actual: row.load, expected: load ? row.metricValues.find(value => value.metricId === load.id)?.value : null },
        repsField: { actual: row.reps, expected: reps ? row.metricValues.find(value => value.metricId === reps.id)?.value : null },
      };
    }), state);
    throw new Error(`Per-side history fixture fails the production state validator before seed: ${JSON.stringify(diagnostics)}`);
  }
  await seed(page, state);
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

async function completeCompiledProgram(page, { days = 4, minutes = 90, edits = [] } = {}) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.() &&
    typeof window.__repforgeFinalizeProgramSetup === "function", undefined, { timeout: 15000 });
  await page.evaluate(async ({ days, minutes, edits }) => {
    // Plan 067: the legacy services.compile()/programStructure/compilerContext path is
    // retired. A canonical ProgramDefinition now comes from the same generator the
    // Recommend route itself drives, finalized the same way `__repforgeFinalizeProgramSetup` expects.
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "balanced", structuredExperience: "6_to_24m", daysPerWeek: days, sessionMinutes: minutes,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalog);
    if (!generated.ok) throw new Error(`catalog compiler failed: ${JSON.stringify(generated.conflicts || generated)}`);
    // Block edits shaped as the installed editor writes them, so a Review
    // regeneration has something to carry, clamp or drop.
    const slots = generated.value.days.flatMap((day) => day.slots);
    for (const edit of edits) {
      const slot = slots.find((candidate) => new RegExp(edit.role).test(candidate.role));
      const cycle = slot.prescriptionsByCycle.find((item) => item.cycleIndex === edit.week);
      for (let added = 0; added < (edit.addSets || 0); added++) {
        cycle.sets.push({ ...structuredClone(cycle.sets.at(-1)), id: `catalog-edit-${slot.id}-${cycle.sets.length + 1}`,
          setIndex: cycle.sets.length + 1, rir: null, status: "manual", provenance: { source: "manual", policyVersion: "manual@1" } });
      }
      if (edit.restSeconds) for (const set of cycle.sets) { set.restSeconds = edit.restSeconds; set.status = "manual"; }
    }
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
  }, { days, minutes, edits });
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
  await page.waitForSelector("[data-diag-continue]");
  // The click scrolls the action into view, and the page's scroll-edge bar follows its title through an
  // IntersectionObserver that reports asynchronously: the frame waits until the bar agrees with where the title is.
  await page.waitForFunction(() => {
    const bar = document.querySelector("#statsTopbar"), title = document.querySelector("#stats .pagehead .page-title");
    if (!bar || !title) return true;
    const cutoff = Math.ceil(document.querySelector("#logTopbar")?.getBoundingClientRect().bottom || 44) || 44;
    const box = title.getBoundingClientRect();
    const hidden = box.height > 0 && (box.bottom <= cutoff || box.top >= innerHeight);
    return bar.classList.contains("is-scrolled") === hidden;
  }, undefined, { polling: "raf", timeout: 10000 });
  await sleep(page, 300);
}

async function openSiblingPreview(page, kind) {
  await completeCompiledProgram(page, { edits: kind === "sessions_too_long"
    ? [{ role: "Accessory$", week: 1, addSets: 20 }, { role: "PrimaryCompound$", week: 1, restSeconds: 3600 }]
    : [{ role: "PrimaryCompound$", week: 2, addSets: 1 }] });
  await openScheduleDiagnosis(page);
  if (kind === "sessions_too_long") await page.click('[data-diag="sessions_too_long"]');
  if (kind === "sessions_too_long") await page.fill("[data-diag-target]", "60");
  else await page.click('[data-diag-days="3"]');
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

/** A Settings disclosure animates its height; the frame is placed once it has its final size. */
async function disclosureSettled(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  // The height runs 200 ms through Motion, which may not surface as a document animation.
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

/**
 * Pin a sheet's scroll to its end rather than its start: a frame that must
 * show an element near the bottom (the busy delete/archive button) needs a
 * fixed *maximum* scrollTop, not zero. Wait for web fonts first — the form's
 * scrollHeight shifts as chip rows and labels finish laying out, and reading
 * scrollHeight before that settles reproduces the same race this is fixing.
 */
async function pinSheetScrollToEnd(page, selector) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator(selector).evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
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
  await focusMode(page);
  await logCurrentSet(page, { load: "102.5", reps: "8", rir: "1" });
  // The rest timer redesign: the rest rises as a tab out of the shelf's top edge (no clock in the card).
  await page.waitForSelector("#workout .exercise.is-current .focus-shelf #restTab", { timeout: 20000 });
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
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`);
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
  const state = await installGeneratedProgram(page, { name: "Why sheet proof" });
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

async function startWhyViewportTracking(page, exerciseId, index) {
  await page.evaluate(({ id, index }) => {
    const contexts = new Set();
    const events = [];
    const active = new Map();
    const seen = new WeakSet();
    const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: round(box.x), y: round(box.y), top: round(box.top), right: round(box.right),
        bottom: round(box.bottom), left: round(box.left), width: round(box.width), height: round(box.height) };
    };
    const ownerName = owner => {
      if (owner === document || owner === window || owner === document.scrollingElement) return "document";
      if (owner?.classList?.contains("fcard__context")) {
        const article = owner.closest(".exercise");
        return `focus-context:${article?.dataset.ex || article?.dataset.peek || "unknown"}`;
      }
      return owner?.id ? `#${owner.id}` : owner?.tagName?.toLowerCase() || "unknown";
    };
    const ownerOffset = owner => {
      const element = owner === document || owner === window ? document.scrollingElement : owner;
      return { owner: ownerName(owner), top: round(element ? element.scrollTop : window.scrollY),
        left: round(element ? element.scrollLeft : window.scrollX), rect: rect(element) };
    };
    const scrollOwner = event => event.target === document || event.target === window
      ? document.scrollingElement : event.target;
    const record = (kind, event) => {
      if (seen.has(event)) return;
      seen.add(event);
      const owner = scrollOwner(event);
      if (kind === "scroll") active.set(owner, true);
      else active.delete(owner);
      events.push({ kind, at: round(performance.now()), ...ownerOffset(owner),
        activeOwners: [...active.keys()].map(ownerName) });
    };
    const onScroll = event => record("scroll", event);
    const onScrollEnd = event => record("scrollend", event);
    const attachTargetContext = () => {
      for (const context of document.querySelectorAll("#workout .exercise .fcard__context")) {
        const article = context.closest(".exercise");
        if (article?.dataset.ex !== id && article?.dataset.peek !== id) continue;
        if (contexts.has(context)) continue;
        contexts.add(context);
        context.addEventListener("scroll", onScroll, { passive: true });
        context.addEventListener("scrollend", onScrollEnd, { passive: true });
      }
    };
    const observer = new MutationObserver(attachTargetContext);
    observer.observe(document.documentElement, { subtree: true, childList: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("scrollend", onScrollEnd, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd, { passive: true });

    const snapshot = () => {
      const current = document.querySelector("#workout.is-focus .exercise.is-current");
      const context = current?.querySelector(".fcard__context");
      const button = current?.querySelector("[data-why]");
      const shell = document.querySelector("#workoutShell");
      const contextRect = rect(context), buttonRect = rect(button);
      return {
        selectedExerciseId: current?.dataset.ex || null,
        focus: document.querySelector("#workout")?.classList.contains("is-focus") || false,
        route: {
          bodyClass: document.body.className,
          activeView: document.querySelector(".view.active")?.id || null,
          shell: rect(shell), shellClass: shell?.className || null,
        },
        scroll: {
          windowY: round(window.scrollY), windowX: round(window.scrollX),
          documentY: round(document.scrollingElement?.scrollTop || 0),
          logY: round(document.querySelector("#log")?.scrollTop || 0),
          shellY: round(document.querySelector("#workoutShell")?.scrollTop || 0),
          workoutY: round(document.querySelector("#workout")?.scrollTop || 0),
          contextY: round(context?.scrollTop || 0),
        },
        geometry: {
          article: rect(current), context: contextRect, heading: rect(current?.querySelector(".fx-head")),
          cue: rect(current?.querySelector(".fx-cue")), why: buttonRect,
          whyInsideContext: !!(buttonRect && contextRect && buttonRect.top >= contextRect.top - 1
            && buttonRect.bottom <= contextRect.bottom + 1 && buttonRect.left >= contextRect.left - 1
            && buttonRect.right <= contextRect.right + 1 && buttonRect.top >= 0
            && buttonRect.bottom <= document.documentElement.clientHeight),
          deckClass: document.querySelector("#focusDeck")?.className || null,
          trackClass: document.querySelector("#focusTrack")?.className || null,
          trackTransform: getComputedStyle(document.querySelector("#focusTrack") || document.body).transform,
          whySheetOpen: document.querySelector("#whySheet")?.classList.contains("is-open") || false,
        },
      };
    };
    const tracker = {
      exerciseId: id, navigationIndex: index, events, active, contexts,
      beforeClick: null, afterSheet: null, captured: null,
      snapshot,
      report: () => ({
        exerciseId: id,
        navigation: index === 0 ? "first-focus-exercise" : "focus-progress-segment",
        navigationIndex: index,
        beforeClick: tracker.beforeClick,
        afterSheet: tracker.afterSheet,
        captured: tracker.captured || snapshot(),
        globalOwners: ["document", "window"],
        pendingScrollOwners: [...active.keys()].map(ownerName),
        scrollEventCount: events.length,
        scrollEvents: events,
        trackedOwners: [...contexts].map(ownerName),
      }),
      stop: () => {
        observer.disconnect();
        document.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("scrollend", onScrollEnd, true);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("scrollend", onScrollEnd);
        for (const context of contexts) {
          context.removeEventListener("scroll", onScroll);
          context.removeEventListener("scrollend", onScrollEnd);
        }
        delete window.__whyCatalogViewport;
      },
    };
    window.__whyCatalogViewport = tracker;
    attachTargetContext();
  }, { id: exerciseId, index });
}

async function waitForWhyViewport(page, exerciseId, phase) {
  const result = await page.evaluate(({ id, phase: targetPhase }) => new Promise((resolve) => {
    const tracker = window.__whyCatalogViewport;
    const started = performance.now();
    const timeoutMs = 10000;
    const workoutRect = () => {
      const element = document.querySelector("#workout");
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    let prior = "";
    let stableFrames = 0;
    let last = null;
    const tick = () => {
      last = tracker?.snapshot();
      const current = document.querySelector("#workout.is-focus .exercise.is-current");
      const track = document.querySelector("#focusTrack");
      const deck = document.querySelector("#focusDeck");
      const shell = document.querySelector("#workoutShell");
      const workoutBounds = workoutRect();
      const selected = current?.dataset.ex === id;
      const sheetOpen = document.querySelector("#whySheet")?.classList.contains("is-open") || false;
      const viewportVisible = targetPhase !== "beforeClick" || last?.geometry?.whyInsideContext;
      const targetGeometry = last?.geometry?.why?.width > 0 && last?.geometry?.why?.height > 0;
      const routeSettled = !document.body.classList.contains("is-pushing")
        && !shell?.classList.contains("is-push-over") && Math.abs(workoutBounds?.x ?? Infinity) < 1;
      const ready = !!tracker && selected && targetGeometry && routeSettled
        && tracker.active.size === 0 && viewportVisible
        && !track?.classList.contains("is-settling") && !deck?.classList.contains("is-swiping")
        && (targetPhase !== "afterSheet" || sheetOpen);
      const signature = ready ? JSON.stringify(last) : "";
      stableFrames = ready && signature === prior ? stableFrames + 1 : ready ? 1 : 0;
      prior = signature;
      if (ready && stableFrames >= 3) {
        const completion = tracker.events.length ? "scrollend" : "no-scroll";
        const settled = { ...last, scrollCompletion: completion, scrollEventCount: tracker.events.length, stableFrames };
        if (targetPhase === "beforeClick") tracker.beforeClick = settled;
        else if (targetPhase === "afterSheet") tracker.afterSheet = settled;
        resolve({ ok: true, ...settled });
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        resolve({ ok: false, phase: targetPhase, timeoutMs, snapshot: last,
          activeOwners: [...(tracker?.active?.keys() || [])].map(owner => {
            if (owner === document.scrollingElement) return "document";
            const article = owner?.closest?.(".exercise");
            return article ? `focus-context:${article.dataset.ex || article.dataset.peek || "unknown"}` : owner?.id || owner?.tagName || "unknown";
          }), scrollEvents: tracker?.events || [] });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { id: exerciseId, phase });
  if (!result?.ok) throw new Error(`Why capture ${phase} did not settle: ${JSON.stringify(result)}`);
  return result;
}

async function whyViewportOperation(page, label, operation) {
  try {
    return await operation();
  } catch (error) {
    const geometry = await page.evaluate(() => {
      const tracker = window.__whyCatalogViewport;
      if (tracker) return tracker.report();
      const describe = element => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { className: element.className, x: box.x, y: box.y, width: box.width, height: box.height };
      };
      return { bodyClass: document.body.className, activeView: document.querySelector(".view.active")?.id || null,
        scroll: { windowY: window.scrollY, documentY: document.scrollingElement?.scrollTop || 0 },
        workout: describe(document.querySelector("#workout")), shell: describe(document.querySelector("#workoutShell")),
        current: describe(document.querySelector("#workout .exercise.is-current")) };
    }).catch(() => ({ unavailable: true }));
    throw new Error(`${label}: ${JSON.stringify(geometry)}`, { cause: error });
  }
}

async function navigateToWhy(page, { exerciseId, day, index = 0 }) {
  await startWhyViewportTracking(page, exerciseId, index);
  await page.evaluate((targetDay) => window.__repforgeEnterWorkout({ day: targetDay }), day);
  await whyViewportOperation(page, "Focus did not mount for Why capture", () =>
    page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 }));
  if (index > 0) {
    await whyViewportOperation(page, `Focus progress did not select ${exerciseId}`, () =>
      page.locator(`#woProgress [data-focusgo="${index}"]`).click({ timeout: 10000 }));
  }
  await waitForWhyViewport(page, exerciseId, "selected");
  const why = page.locator(`#workout .exercise.is-current[data-ex="${exerciseId}"] [data-why]`);
  await whyViewportOperation(page, `Why control did not reach the viewport for ${exerciseId}`,
    () => why.scrollIntoViewIfNeeded({ timeout: 10000 }));
  await waitForWhyViewport(page, exerciseId, "beforeClick");
  await whyViewportOperation(page, `Why sheet did not open for ${exerciseId}`, async () => {
    await why.click({ timeout: 10000 });
    await page.waitForSelector("#whySheet.is-open", { timeout: 10000 });
  });
  await waitForWhyViewport(page, exerciseId, "afterSheet");
}

async function whyOnBuildRange(page) {
  const row = catalogState().program[0];
  await navigateToWhy(page, { exerciseId: row.id, day: row.day });
  await expectWhyLeads(page, ["manual"]);
  const text = await page.locator("#whyBody .whysheet__text").textContent();
  const expected = await page.evaluate(() => window.RepForgeI18n.t("why.manual"));
  if (text?.trim() !== expected) throw new Error(`The Build-backed manual Why sentence was ${JSON.stringify(text)}`);
}

async function whyOnGeneratedPerSide(page) {
  const target = await page.evaluate(async (request) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalog);
    if (!generated.ok) throw new Error(`generation failed: ${JSON.stringify(generated.conflicts || generated)}`);
    const definition = generated.value;
    const perSide = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot) => ({ day, slot }))).find(({ slot }) =>
      slot.metricDefinitions.some((metric) => metric.semantic === "loadPerSideKg") &&
      slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide"));
    if (!perSide) return null;
    const source = catalog.exercises.find((entry) => entry.id === "3895c6f170d88002b51fdf96c7dc50e1");
    const metrics = window.RepForgeExerciseMetrics.definitionsForIds(source?.exerciseMetrics || []);
    if (!source || !metrics?.ok) throw new Error("The ambiguous per-side catalog source or its canonical metric definitions are unavailable");
    perSide.slot.exerciseId = source.id;
    perSide.slot.sourceExerciseIds = [source.id];
    perSide.slot.exerciseTypeId = source.exerciseType;
    perSide.slot.displayName = source.name;
    perSide.slot.musclePurposeIds = [...source.primaryFeatureMuscle];
    perSide.slot.movementPatternIds = [...source.movementPattern];
    perSide.slot.metricIds = [...source.exerciseMetrics];
    perSide.slot.metricDefinitions = metrics.value;
    perSide.slot.metricOrigin = "source_catalog";
    perSide.slot.lateralityIds = [...source.laterality];
    perSide.slot.executionMode = null;
    perSide.slot.loadingModel = { ...perSide.slot.loadingModel, bodyweightCoefficient: source.bodyweight };
    for (const cycle of perSide.slot.prescriptionsByCycle) {
      for (const set of cycle.sets) {
        set.targets = { repsPerSide: { min: 6, max: 10 }, loadPerSideKg: { min: 20, max: 35 } };
      }
    }
    const valid = window.RepForgeProgramCompiler.validateProgramDefinition(definition, catalog, []);
    if (!valid.ok) throw new Error(`The unknown-mode generated slot is invalid: ${JSON.stringify(valid.issues)}`);
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Why setup proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "why-sheet-067" },
    });
    await window.__repforgeStorage.flush();
    const program = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || [];
    const row = program.find((candidate) => candidate.slotId === perSide.slot.id);
    const dayRows = program.filter((candidate) => candidate.day === perSide.day.name);
    return row && { id: row.id, day: perSide.day.name, mode: perSide.slot.executionMode,
      sourceId: source.id,
      index: dayRows.findIndex((candidate) => candidate.id === row.id) };
  }, WHY_REQUEST);
  if (!target || target.mode !== null || target.sourceId !== PER_SIDE_MODE_MISSING_EXERCISE)
    throw new Error(`The generated per-side fixture does not have a genuinely missing mode: ${JSON.stringify(target)}`);
  await page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return !toast || toast.classList.contains("hidden");
  }, undefined, { timeout: 10000 });
  await navigateToWhy(page, { exerciseId: target.id, day: target.day, index: target.index });
  const truth = await page.evaluate((id) => {
    const ex = window.__repforgeProgression.programSlot(id);
    const rec = window.__repforgeProgression.recommendation(ex);
    return { status: rec.status, reasonCodes: rec.reasonCodes, load: rec.load };
  }, target.id);
  if (truth.status !== "configuration_required" || !truth.reasonCodes?.includes("execution_context_required") || truth.load != null)
    throw new Error(`The ambiguous generated slot lost its execution-mode requirement or acquired a load: ${JSON.stringify(truth)}`);
  await expectWhyLeads(page, ["setup"]);
  const text = await page.locator("#whyBody .whysheet__text").textContent();
  const expected = await page.evaluate(() => window.RepForgeI18n.t("why.setup.execution_mode"));
  if (text?.trim() !== expected) throw new Error(`The generated per-side Why sentence was ${JSON.stringify(text)}`);
}

async function focusPerSideTarget(page) {
  await installPerSideHistory(page, { bodyweightAssumption: true });
  const row = await page.evaluate((libraryId) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return state.program?.find((entry) => entry.libraryId === libraryId) || null;
  }, PER_SIDE_READING_EXERCISES.bilateral);
  if (!row) throw new Error("The generated program has no bilateral per-side press row");
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), row.id);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    row.id, { timeout: 15000 });
  const result = await page.evaluate(({ id, loadMetricId }) => {
    const exercise = window.__repforgeProgression.programSlot(id);
    const recommendation = window.__repforgeProgression.recommendation(exercise);
    const target = recommendation.targetSets?.find(item => item.prescription?.setIndex === 1)?.result;
    const input = document.querySelector(`#workout .exercise.is-current input[data-metric-id="${loadMetricId}"]`);
    return {
      engineStatus: recommendation.engineStatus,
      targetLoad: target?.targets?.loadPerSideKg,
      prefillsPerSide: Number(input?.value) === target?.targets?.loadPerSideKg,
      assumptions: target?.loadingAssumptions,
      slotMode: exercise.executionMode,
    };
  }, { id: row.id, loadMetricId: PER_SIDE_LOAD_METRIC });
  if (result.engineStatus !== "recommended" || !(result.targetLoad > 0) || !result.prefillsPerSide
    || result.assumptions?.externalLoadMultiplier !== 2 || !(result.assumptions?.bodyweightContributionKg > 0)) {
    throw new Error(`The generated Focus fixture does not show its per-side target and bodyweight assumption: ${JSON.stringify(result)}`);
  }
  const presentation = await page.evaluate((metricId) => {
    const field = document.querySelector(`#workout .exercise.is-current [data-metric="${metricId}"]`);
    const label = field?.querySelector(".shelf__lab")?.textContent?.trim() || "";
    return {
      fieldText: field?.textContent?.trim() || "",
      label,
      whyOpen: document.querySelector("#whySheet")?.classList.contains("is-open") || false,
    };
  }, PER_SIDE_LOAD_METRIC);
  const expectedLabel = await page.evaluate(() => window.RepForgeI18n.t("focus.metric.load_per_side_kg"));
  if (!presentation.fieldText.includes(String(result.targetLoad)) || !presentation.label.startsWith(expectedLabel) || presentation.whyOpen) {
    throw new Error(`The ordinary Focus state does not show its per-side prefill and label without opening Why: ${JSON.stringify({ result, presentation, expectedLabel })}`);
  }
}

/**
 * Opens the Why sheet from a Focus card with the page in one place every run. The sheet rests at its medium detent
 * (ADR 0023), so the Focus page under it shows in the frame; a locator tap scrolls the link in only "if needed", by
 * an amount that depends on when layout settles. So the page is scrolled to put the link at a fixed height first,
 * and then a real tap lands on it there (a tap, so the sheet's close takes a quiet focus, as on a phone).
 */
async function clickWhy(page, selector) {
  // Measure a settled card: the Focus window's scroll at rest and the card's finite motion finished, so nothing moves
  // the link between the measure and the tap.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation.effect?.getTiming?.().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))));
  await page.evaluate(() => { window.__catalogWhyRest = null; });
  await page.waitForFunction(() => {
    const context = document.querySelector("#workout .exercise--focus.is-current .fcard__context");
    const at = context ? Math.round(context.scrollTop) : -1, seen = window.__catalogWhyRest ||= { at: null, still: 0 };
    if (seen.at === at) seen.still++; else { seen.at = at; seen.still = 0; }
    return seen.still >= 3;
  }, undefined, { polling: "raf", timeout: 10000 });
  // The link may sit in Focus's own scroller, so the browser places it (whichever scroller holds it), centred first;
  // the first placement where nothing (a tall header at 200% text, the shelf) covers it is the same every run.
  // Focus answers a scroll of its own window by settling it again (the open set is kept in view), so a placement can
  // move after it is made. Each placement is read only once the link has held its place for three frames.
  const point = await page.evaluate(async (sel) => {
    const link = document.querySelector(sel);
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const settled = async () => {
      let last = null, still = 0;
      for (let tries = 0; tries < 120 && still < 3; tries++) {
        await frame();
        const top = Math.round(link.getBoundingClientRect().top);
        still = top === last ? still + 1 : 0;
        last = top;
      }
      return link.getBoundingClientRect();
    };
    for (const block of ["center", "start", "end"]) {
      window.scrollTo({ top: 0, behavior: "instant" });
      link.scrollIntoView({ block, behavior: "instant" });
      const r = await settled();
      const p = { x: r.left + Math.min(r.width / 2, 40), y: r.top + Math.min(r.height / 2, 12) };
      if (p.y > 0 && p.y < innerHeight && document.elementFromPoint(p.x, p.y)?.closest(sel)) return p;
    }
    return null;
  }, selector);
  if (!point) throw new Error(`no clear spot to tap ${selector}`);
  await page.mouse.click(point.x, point.y);
  // A tap that opens nothing names what it hit, so a failure carries its own evidence.
  const opened = await page.waitForSelector("#whySheet.is-open", { timeout: 15000 }).then(() => true, () => false);
  if (!opened) {
    const seen = await page.evaluate(({ sel, point }) => {
      const hit = document.elementFromPoint(point.x, point.y), link = document.querySelector(sel);
      const context = document.querySelector("#workout .exercise--focus.is-current .fcard__context");
      return { point, hit: hit ? `${hit.tagName}.${hit.className}` : null, onLink: !!hit?.closest(sel),
        link: link ? JSON.stringify(link.getBoundingClientRect()) : null, scrollTop: context?.scrollTop ?? null,
        sheet: document.querySelector("#whySheet")?.className || null, lang: document.documentElement.lang };
    }, { sel: selector, point });
    throw new Error(`tapping ${selector} did not open the Why sheet: ${JSON.stringify(seen)}`);
  }
}

async function whyPerSideAssumption(page) {
  await focusPerSideTarget(page);
  await clickWhy(page, "#workout .exercise.is-current [data-why]");
  await page.waitForSelector("#whySheet.is-open", { timeout: 10000 });
  const text = await page.locator("#whyBody").innerText();
  const lang = await page.locator("html").getAttribute("lang");
  const localizedAssumption = lang.toLowerCase().startsWith("pt")
    ? "por lado × 2" : "per side × 2";
  const localizedAnchor = lang.toLowerCase().startsWith("pt")
    ? "mais recentemente com 27,5 kg por lado" : "last at 27.5 kg per side";
  if (!text.includes(localizedAssumption) || !/3[,.]04/.test(text)
    || !text.includes(localizedAnchor)
    || !(lang.toLowerCase().startsWith("pt") ? text.includes("peso corporal") : text.includes("bodyweight"))) {
    throw new Error(`The rendered Why sheet omits the approved per-side anchor or multiplier/bodyweight assumption: ${JSON.stringify({ text, lang })}`);
  }
  await expectWhyLeads(page, ["engine-anchor", "engine-target", "engine-assumptions"]);
}

let programLabPreview;
export async function cleanupProgramLabCapture() {
  if (programLabPreview) { const preview = await programLabPreview; preview.cleanup(); programLabPreview = null; }
}
async function captureProgramLab(page, result = false) {
  const language = await page.evaluate(() => navigator.language.startsWith('pt') ? 'pt' : 'en');
  if (!programLabPreview) programLabPreview = (async () => {
    const outDir = join(await mkdtemp(join(tmpdir(), 'taurifer-lab-catalog-')), 'artifact');
    await buildProgramLab({ outDir });
    // A browser lane makes the owner start a preview; #460 retired `visual`, which left this null.
    const preview = await maybeStartLocalPreview([{ lane: 'state' }], { cwd: outDir, prepareApp: false, env: { ...process.env, REPFORGE_URL: '' } });
    if (!preview) throw new Error('Program Lab capture needs an isolated artifact preview');
    return preview;
  })();
  const preview = await programLabPreview;
  await page.goto(preview.env.REPFORGE_URL);
  await page.locator('html[data-lab-ready="true"]').waitFor();
  await page.locator('#language').selectOption(language);
  await page.locator(`html[lang="${language}"]`).waitFor();
  await page.locator('#fixture').selectOption('anchor-4day');
  await page.locator('#preset').selectOption('two_sets_low_rir@1');
  await page.locator('#applyPreset').click();
  if (result) {
    await page.locator('#run').click();
    await page.locator('#runStatus').filter({ hasText: /completed|concluído/i }).waitFor({ timeout: 120000 });
    await page.locator('#candidateHeading').evaluate(element => element.scrollIntoView({ block: 'start' }));
  } else {
    // Frame the stable editor subject; source identity remains visible in the
    // normal header and is verified separately by the packaged journey.
    await page.locator('#scenarioHeading').evaluate(element => element.scrollIntoView({ block: 'start' }));
  }
}
export const APP_SCENARIOS = {
  "programlab/editor": page => captureProgramLab(page),
  "programlab/comparison": page => captureProgramLab(page, true),
  "catalog-recovery/unavailable": reloadWithUnavailableExerciseCatalog,
  "catalog-recovery/retry-failed": async page => {
    await reloadWithUnavailableExerciseCatalog(page);
    await page.click("#retryExerciseCatalog");
    // The click first disables the button and shows a transient "retrying…"
    // status (non-empty text) before the retry resolves; waiting on mere
    // non-empty status text raced that transient state. Wait for the retry
    // to actually conclude (the button re-enabled) before reading the outcome.
    await page.waitForFunction(() => document.querySelector("#retryExerciseCatalog")?.disabled === false, undefined, { timeout: 10000 });
    const state = await page.evaluate(() => ({
      open: document.querySelector("#exerciseCatalogRecovery")?.open === true,
      retryEnabled: document.querySelector("#retryExerciseCatalog")?.disabled === false,
      booted: window.__repforgeBooted === true,
    }));
    if (!state.open || !state.retryEnabled || state.booted) throw new Error(`Failed retry lost its recovery path: ${JSON.stringify(state)}`);
  },
  "today/no-program": async (page) => { await dismissChrome(page); await sleep(page, 300); },
  "today/deload-week": async page => {
    const note = page.locator("#todayProgram .today-prog__deload");
    await note.waitFor({ state: "visible", timeout: 20000 });
    const copy = await page.evaluate(() => window.RepForgeI18n.t("today.deload_week"));
    if ((await note.innerText()).trim() !== copy) throw new Error("Today shows the wrong deload recovery note");
  },
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
  // Plan 075 phase 5 (ADR 0023 choice 10): a finger held on the dock's Progress tab. The touch stays down while the frame
  // is taken. At 200% text the viewer is what the capture shows; at the usual size the labels are whole, the viewer is
  // not offered, and the frame is the press alone.
  "today/dock-viewer": async (page) => {
    await dismissChrome(page);
    await page.locator("#todayExList .rxrow").first().waitFor({ state: "visible", timeout: 20000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    const tab = await page.locator('nav button[data-view="stats"]').boundingBox();
    if (!tab) throw new Error("The dock's Progress tab is not on screen");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 }] });
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      await page.waitForFunction(() => document.querySelector(".dock-viewer .dock-viewer__label")?.textContent.trim().length > 0, undefined, { timeout: 20000 });
    } else {
      await page.waitForFunction(() => document.querySelector('nav button[data-view="stats"]')?.classList.contains("is-pressed"), undefined, { timeout: 20000 });
    }
  },
  // Plan 075 phase 3 (ADR 0023): the scroll-edge bar once the large title has
  // scrolled under it. Same fixture and the same ready state as "today/ready",
  // scrolled all the way down so the title is fully behind the bar.
  "today/ready-scrolled": async (page) => {
    await dismissChrome(page);
    const rows = page.locator("#todayExList .rxrow");
    await rows.first().waitFor({ state: "visible", timeout: 20000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector("#logTopbar")?.classList.contains("is-scrolled"), undefined, { timeout: 20000 });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#logTopbar .topbar__title")).opacity) === 1, undefined, { timeout: 20000 });
    await sleep(page, 300);
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
          // Plan 075 phase 2 retired Confirm/Cancel: tapping a row commits, and the
          // band's × (data-daypick-close) is the sheet's one remaining action.
          const actions = ["[data-daypick-close]"].map((selector) => {
            const button = document.querySelector(selector);
            if (!button) return { selector, visible: false, labelFits: false, inViewport: false };
            const box = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return { selector, visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0,
              labelFits: textFits(button), inViewport: box.top >= -1 && box.bottom <= innerHeight + 1 };
          });
          const list = document.querySelector("#dayPickList");
          const rows = [...(list?.querySelectorAll(".daypick__row") || [])];
          // Scrolling to the bottom is a no-op when the list already fits —
          // that still makes the last row reachable, so this does not require
          // scrollHeight to exceed clientHeight (Plan 075 phase 2 dropped the
          // sheet's footer, and a short split can now fit without scrolling).
          let lastChoiceReachable = false;
          if (list && rows.length && ["auto", "scroll", "overlay"].includes(getComputedStyle(list).overflowY)) {
            const originalTop = list.scrollTop;
            list.scrollTop = list.scrollHeight;
            const listBox = list.getBoundingClientRect(), lastBox = rows.at(-1).getBoundingClientRect();
            lastChoiceReachable = lastBox.top >= listBox.top - 1 && lastBox.bottom <= listBox.bottom + 1;
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
  "workout/first-set-guide": async (page) => {
    // Replayed away from Focus, the guide waits for its anchor; in Focus it waits for the first tap on the shelf.
    await page.evaluate(() => window.__repforgeUi.replayGuide("first-set"));
    await page.waitForFunction(() => window.__repforgeUi.guideState()["first-set"]?.status === "deferred", undefined, { timeout: 20000 });
    await focusMode(page);
    await page.locator('.focus-shelf .shelf__fieldbtn[data-shelf-field][aria-pressed="false"]').first().click();
    await page.waitForFunction(() => !!document.querySelector('dialog#guideDialog[open][data-guide="first-set"]'), undefined, { timeout: 20000 });
    await sleep(page, 300);
  },
  "workout/focus-utilities-guide": async (page) => { await focusMode(page); await replayGuide(page, "focus-utilities"); },
  "workout/focus-per-side": focusPerSideTarget,
  "workout/why-per-side": whyPerSideAssumption,
  "workout/deload-week": async page => {
    await page.click("#startWorkout");
    await page.locator("#workoutShell").waitFor({ state: "visible", timeout: 20000 });
    const cue = await page.locator("#woDaySub").evaluate(node => ({
      visible: getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden",
      text: node.textContent.trim(),
    }));
    const copy = await page.evaluate(() => window.RepForgeI18n.t("today.deload_week"));
    if (!cue.visible || cue.text !== copy) throw new Error(`Focus deload note is missing: ${JSON.stringify(cue)}`);
  },
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
  // #522: the confirmation opens at the end of the scroll, so the frame shows the scroll pinned to its end.
  "workout/early-finish": async page => { await focusMode(page); await logCurrentSet(page); await page.click("#sessionSheetBtn"); await page.click("#sessionEarlyFinish"); await pinSheetScrollToEnd(page, ".session-sheet__body"); },
  "workout/abandon": async page => {
    await focusMode(page);
    await logCurrentSet(page);
    await page.click("#sessionSheetBtn");
    await page.click("#sessionAbandon");
    await page.locator('#sessionAbandonReasons [data-abandon-reason="time"]').click();
    await pinSheetScrollToEnd(page, ".session-sheet__body");
  },
  "workout/exercise-actions": async page => { await focusMode(page); await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click(); await resetSheetScroll(page, ".exactions-sheet__body"); },
  "workout/skipped-actions": async page => {
    await focusMode(page);
    const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
    await page.locator("#exActionSkipBtn").click();
    await page.locator("#exActionsSheet").waitFor({state:"hidden"});
    await page.locator("#sessionSheetBtn").click();
    await page.locator(`[data-session-map-jump="${id}"]`).click();
    await page.locator("#exActionsSheet.is-open").waitFor();
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/substituted-actions": async page => {
    await focusMode(page);
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
    await page.locator("#exActionSubstBtn").click();
    await page.locator("#exPickList .pickrow").first().click();
    await page.locator("#exPickSheet").waitFor({state:"hidden"});
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
    // The reopened sheet keeps its body's last scroll until it has opened; a reset before then was undone, and the frame
    // showed the body scrolled past its first heading (full lane, 2026-10-24). Reset once it has settled.
    await page.locator("#exActionsSheet.is-open").waitFor();
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/swap-alternates": async page => {
    await focusMode(page);
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
    await page.locator("#exActionSubstBtn").click();
    await page.locator("#exPickSheet.is-open .pick__section").first().waitFor();
    await sleep(page, 400);
  },
  "workout/swap-reason": async page => {
    await focusMode(page);
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
    await page.locator("#exActionSubstBtn").click();
    await page.locator("#exPickSheet.is-open .pick__section").first().waitFor();
    await page.locator('#exPickReasons [data-pick-reason="crowded"]').click();
    await resetSheetScroll(page, "#exPickList");
    await sleep(page, 400);
  },
  "workout/warmup-actions": async page => { await focusMode(page); await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click(); await page.locator("#exActionsWarmupList [data-warm-toggle-set]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); await resetSheetScroll(page, ".exactions-sheet__body"); },
  // The session map reorders as the editor does: the row's menu (long-press, or its button for the keyboard) moves it.
  "workout/reorder": async page => {
    await focusMode(page);
    await page.click("#sessionSheetBtn");
    const before = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exerciseId = document.querySelector("#sessionMap [data-session-row-menu]")?.dataset.sessionRowMenu;
      return {
        exerciseId,
        beforeRevision: draft?.revision ?? -1,
        expectedIndex: exerciseId ? (draft?.exerciseOrder || []).indexOf(exerciseId) + 1 : -1,
      };
    });
    await page.locator("#sessionMap [data-session-row-menu]").first().evaluate((button) => button.click());
    await page.locator('#nativeContextMenu [data-menu-value="down"]').click();
    await page.waitForFunction(({ exerciseId, beforeRevision, expectedIndex }) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      return exerciseId && draft?.revision > beforeRevision && draft.exerciseOrder?.[expectedIndex] === exerciseId
        && !document.querySelector("#nativeContextMenu") && document.activeElement?.dataset?.sessionRowMenu === exerciseId;
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
  "workout/correction": async page => { await focusMode(page); await logCurrentSet(page); await openFoldedSets(page); await page.locator("#workout .exercise.is-current [data-editn]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); },
  // #517: two logged sets shown in place above the open one while the rest runs, because they fit.
  "workout/logged-sets": async page => { await focusMode(page); await logCurrentSet(page); await logCurrentSet(page); await page.waitForSelector("#workout .exercise.is-current [data-editn]", { state: "attached" }); await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    // The logged set starts the rest; the tab rises out of the shelf once that render has run.
    await page.waitForSelector("#restTab", { timeout: 20000 });
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    // The card then brings its open row into view; the frame is taken once that scroll has come to rest.
    await page.waitForFunction(() => {
      const context = document.querySelector("#workout .exercise--focus.is-current .fcard__context");
      const at = context ? Math.round(context.scrollTop) : -1, seen = window.__catalogScrollRest ||= { at: null, still: 0 };
      if (seen.at === at) seen.still++; else { seen.at = at; seen.still = 0; }
      return seen.still >= 5;
    }, undefined, { polling: 100, timeout: 20000 });
    await sleep(page, 200); },
  "today/draft-resume": async page => { await focusMode(page); await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "80"); await page.click("#leaveWorkout"); },
  // Option A: one lift done, one part done, one skipped and the next selected, made with the draft's own commands.
  "today/in-progress": async page => {
    await openSessionShape(page);
    await page.click("#leaveWorkout");
    await page.waitForSelector("#todayLive .today-live", { timeout: 20000 });
  },
  // The mini bar (owner addendum, 2026-10-23): the same open session, seen from the other tabs.
  "progress/minibar": async page => { await miniBarOn(page, "stats"); },
  "history/minibar-rest": async page => {
    await miniBarOn(page, "history");
    await page.evaluate(() => { window.startRest(84); });
    await page.waitForFunction(() => document.querySelector("#miniBar.is-rest #miniBarPlus:not([hidden])"), undefined, { timeout: 20000 });
  },
  "program/minibar-rest-done": async page => {
    await miniBarOn(page, "program");
    await page.evaluate(() => { window.startRest(90); window.__repforgeRest.expire(2); window.syncRest(); });
    await page.waitForFunction(() => document.querySelector("#miniBar.is-rest") && document.querySelector("#miniBarPlus")?.hidden, undefined, { timeout: 20000 });
  },

  "workout/stale-draft": async (page) => {
    await focusMode(page);
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
    await focusMode(page);
    await page.evaluate(() => { window.__repforgeDraftFault = "before-canonical-write"; });
    await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "persist");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  // #517: a banner above the deck shortens the window, so the oldest logged set folds behind the disclosure that counts it.
  "workout/logged-sets-folded": async (page) => {
    await focusMode(page);
    await logCurrentSet(page);
    await logCurrentSet(page);
    await page.evaluate(() => { window.__repforgeDraftFault = "before-canonical-write"; });
    await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "persist");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    // At 390 the window is too short for the logged rows; a wider phone may still have room for them.
    await page.waitForSelector("#workout .exercise.is-current .ledger__more:not([hidden])", { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming?.().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {}))));
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
  // The rest timer redesign: the pinned clock moved to 1:30 of 2:00, read from the tab over the shelf, whose ring and
  // the shelf's top edge show the quarter gone.
  "workout/rest-running": async (page) => {
    await startInlineRest(page);
    await page.evaluate(() => window.nudgeRest(-30));
    await page.waitForFunction(() => document.querySelector("#restTab .resttab__time")?.textContent === "1:30");
    await sleep(page, 400);
  },
  // The tab opens the sheet: the dial at 1:24 of 2:00, the next set, Pause between ±30 s, the presets and the links.
  "workout/rest-sheet": async (page) => {
    await startInlineRest(page);
    await page.evaluate(() => window.nudgeRest(-36));
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("#restDialTime")?.textContent === "1:24");
    await sleep(page, 500);
  },
  // With no rest running there is no tab; the ⋯ sheet's Rest timer row opens the sheet idle, on Start.
  "workout/rest-sheet-idle": async (page) => {
    await focusMode(page);
    await page.locator("#woOverflowBtn").click();
    await page.locator('[data-workout-action="rest"]').click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
    await sleep(page, 500);
  },
  // The bell, fifteen seconds ago: the same seam the accessibility suite uses to run the clock out.
  "workout/rest-done": async (page) => {
    await startInlineRest(page);
    await page.evaluate(() => {
      window.__repforgeRest.expire(15);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForSelector("#restTab.is-done", { timeout: 20000 });
    await sleep(page, 400);
  },
  "today/rest-bar": async (page) => {
    await focusMode(page);
    await logCurrentSet(page);
    await page.click("#leaveWorkout");
    // The session is open, so the live card's tag carries the rest and no pill floats (owner addendum, 2026-10-23).
    await page.waitForFunction(() => {
      const tag = document.querySelector('#todayLive [data-live="elapsed"]')?.textContent || "";
      return !document.body.classList.contains("is-focus-wo") && restEnd > 0
        && /\d:\d\d$/.test(tag) && !document.querySelector("#restBar")
        && !document.querySelector("#restSheet.is-open");
    }, undefined, { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/exercise-note": async (page) => {
    await focusMode(page);
    // The header's ⋯ opens the exercise actions; the note is one of them.
    await page.locator("#woOverflowBtn").click({ timeout: 20000 }); await page.locator('[data-workout-action="exercise"]').click();
    await page.locator("#exActionNotesBtn").click({ timeout: 20000 });
    await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  // Plan 075 phase 2W: a second tap on the selected Load or Reps field opens the
  // wheel. Load is the default-selected field, so the dance moves through Reps
  // and back so the final tap is a genuine second one, the way the test suite does.
  "workout/wheel-load": async (page) => {
    await focusMode(page);
    const shelf = "#workout .exercise.is-current .focus-shelf";
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_REPS_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_WEIGHT_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_WEIGHT_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.waitForSelector("#wheelSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/wheel-reps": async (page) => {
    await focusMode(page);
    const shelf = "#workout .exercise.is-current .focus-shelf";
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_REPS_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_WEIGHT_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_REPS_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.locator(`${shelf} [data-shelf-field="metric_${ADAPTIVE_REPS_METRIC_ID}"]`).click({ timeout: 20000 });
    await page.waitForSelector("#wheelSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/why-this-weight": async (page) => {
    await adaptiveWhyFixture(page);
    await clickWhy(page, "#workout .exercise.is-current [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    await expectWhyLeads(page, ["engine-anchor", "engine-target", "engine-assumptions"]);
  },
  "workout/why-in-session": async (page) => {
    const row = await adaptiveWhyFixture(page);
    await logAdaptiveSet(page, row.slotId || row.id, 1, { load: 45, reps: 8, rir: 2 });
    await clickWhy(page, "#workout .exercise.is-current [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    await expectWhyLeads(page, ["engine-anchor", "engine-target", "engine-assumptions"]);
  },
  "workout/why-manual": whyOnBuildRange,
  "workout/why-setup": whyOnGeneratedPerSide,

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
  "progress/overview-guide": async (page) => { await view(page, "stats"); await replayGuide(page, "progress"); },
  "progress/overview-baseline": (page) => view(page, "stats"),
  "progress/overview-action": (page) => view(page, "stats"),
  "progress/exercise-chart": async (page) => {
    await installPerSideHistory(page);
    await view(page, "stats");
    await startExerciseChartViewportTracking(page);
    const evkey = `library:${PER_SIDE_READING_EXERCISES.bilateral}`;
    await page.evaluate((key) => window.openExerciseView(key, "stats"), evkey);
    await page.waitForSelector("#exercise.view.active .exchart__plot", { timeout: 20000 });
    await waitForExerciseChartRoute(page);
    await page.locator('#exDetail [data-metric="e1rm"]').click();
    await page.waitForSelector("#exDetail .exchart__readout", { timeout: 20000 });
    await waitForExerciseChartMetric(page);
    const chartFocused = await page.evaluate(() => {
      const tracker = window.__exerciseChartViewport;
      if (!tracker) throw new Error("The chart viewport tracker was not installed");
      const snapshot = tracker.snapshot();
      const textScale = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const groupTop = snapshot.geometry.metricGroup?.top ?? null;
      const shifted = rect => rect && groupTop != null
        ? { top: rect.top - groupTop, bottom: rect.bottom - groupTop } : null;
      const plot = shifted(snapshot.geometry.plot), readout = shifted(snapshot.geometry.readout);
      const alignedChartFits = !!plot && !!readout
        && plot.top >= -1 && plot.bottom <= snapshot.viewport.height + 1
        && readout.top >= -1 && readout.bottom <= snapshot.viewport.height + 1;
      const chartFits = textScale >= 32 && alignedChartFits;
      tracker.viewportDecision = { textScale, viewportHeight: snapshot.viewport.height, metricGroupTop: groupTop,
        chartAfterAlignment: { plot, readout }, focusChart: chartFits,
        reason: chartFits ? "aligned chart and readout fit"
          : textScale < 32 ? "keep the established route-top framing at this text scale"
            : "alignment would clip chart or readout" };
      return chartFits;
    });
    if (chartFocused) {
      await page.locator('#exDetail [data-metric="e1rm"]').evaluate(button => {
        const group = button.closest(".segpill");
        if (!group) throw new Error("The e1RM metric has no chart toggle group");
        window.scrollTo({ top: window.scrollY + group.getBoundingClientRect().top, behavior: "instant" });
      });
    } else {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
    await waitForExerciseChartViewport(page, { chartFocused });
  },
  "progress/strength": (page) => progressSegment(page, "strength"),
  "progress/strength-current-block": (page) => progressSegment(page, "strength"),
  "progress/strength-all-history": async (page) => { await progressSegment(page, "strength"); await page.click('#strengthScopeSeg [data-scope="all-history"]'); },
  "progress/strength-comparison": async (page) => {
    await installPerSideHistory(page);
    await progressSegment(page, "strength");
    const row = page.locator(`#strengthDash [data-evkey="library:${PER_SIDE_READING_EXERCISES.bilateral}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.waitForSelector(`[data-evdetail="library:${PER_SIDE_READING_EXERCISES.bilateral}"]`, { timeout: 20000 });
  },
  "progress/strength-sparse": async (page) => { await progressSegment(page, "strength"); const row = page.locator(`#strengthDash [data-evkey="library:${DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID.sqk_mc}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); },
  "progress/volume": (page) => progressSegment(page, "volume"),
  "progress/volume-block": async (page) => { await progressSegment(page, "volume"); await page.click('#volumeScopeSeg [data-vscope="block-to-date"]'); },
  "progress/volume-drill-in": async (page) => { await progressSegment(page, "volume"); await page.locator("#volumeDash [data-volume-muscle]").first().click(); },
  "progress/prs": (page) => progressSegment(page, "prs"),
  "progress/prs-drill-in": async (page) => { await progressSegment(page, "prs"); await page.locator("#prTimeline .prtl__row").first().click(); },
  "progress/review": (page) => progressSegment(page, "review"),
  "progress/review-guide": async (page) => { await progressSegment(page, "review"); await replayGuide(page, "block-transition"); },
  "progress/review-active": (page) => progressSegment(page, "review"),
  "progress/review-complete": openCompletedReview,
  "progress/review-insufficient": openCompletedReview,
  "progress/schedule-diagnosis": openScheduleDiagnosis,
  "progress/sibling-lower-frequency": (page) => openSiblingPreview(page, "fewer_days"),
  "progress/sibling-shorter-session": (page) => openSiblingPreview(page, "sessions_too_long"),
  "progress/guided-repair": async (page) => { await openCompletedReview(page);await page.click('[data-review-action="guided-edit"]');await page.click('[data-diag-days="3"]');await page.click("[data-diag-continue]");await page.waitForSelector(".review__staged",{timeout:20000}); },
  "progress/volume-reduction-preview": async (page) => { await completeCompiledProgram(page);await openCompletedReview(page);await page.click('[data-review-action="reduce-volume"]');await page.click("[data-volume-confirm]");await page.waitForSelector("[data-preview-confirm]",{timeout:20000}); },
  "progress/recovery-ineligible": async (page) => { await openRecoveryPreview(page);await page.click('[data-recovery-answer="Not sure"]'); },
  "progress/recovery-questions": openRecoveryPreview,
  "progress/recovery-preview": recoveryPreview,
  "progress/recovery-active": confirmRecovery,
  "progress/recovery-reassessment": async (page) => { await confirmRecovery(page);await page.evaluate(async()=>{const state=window.__repforgeWorkoutDraft.state();const date=new Date(`${state.programMeta.started}T12:00:00`);date.setDate(date.getDate()-8);state.programMeta.started=date.toISOString().slice(0,10);await window.__repforgeCommitProposedState(state);await window.__repforgeStorage.flush();});await page.reload({waitUntil:"domcontentloaded"});await page.waitForFunction(()=>window.__repforgeBooted===true,undefined,{timeout:20000});await progressSegment(page,"review"); },

  "history/list": (page) => view(page, "history"),
  // Plan 075 phase 3 (ADR 0023): the scroll-edge bar once History's own large
  // title has scrolled under it, scrolled all the way down from the list.
  "history/list-scrolled": async (page) => {
    await view(page, "history");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector("#historyTopbar")?.classList.contains("is-scrolled"), undefined, { timeout: 20000 });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#historyTopbar .topbar__title")).opacity) === 1, undefined, { timeout: 20000 });
    await sleep(page, 300);
  },
  "history/per-side-session": async (page) => {
    await installPerSideHistory(page);
    await view(page, "history");
    const session = page.locator('#sessions .hist-row[data-sess="per-side-history-latest"] .session__open');
    await session.waitFor({ state: "visible", timeout: 20000 });
    await session.click();
    await page.waitForSelector('.session--read[data-reading="per-side-history-latest"] .histpage__totals', { timeout: 20000 });
    await page.waitForSelector('.session--read[data-reading="per-side-history-latest"] .verdictmark--record', { timeout: 20000 });
    await page.waitForFunction(() => !document.body.classList.contains("is-pushing"), undefined, { timeout: 5000 });
  },
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
    // A movement with a licensed illustration (Barbell back squat), so the
    // preview shows the artwork it reserves room for.
    await page.fill("#libSearch", "Barbell back squat");
    const preview = page.locator('#libList [data-lib-preview="1a25c6f170d8803d8231d083fdd65458"]');
    await preview.waitFor({ timeout: 20000 });
    await preview.click();
    await sleep(page, 600);
  },
  "library/exercise-detail": async (page) => {
    // Workout rows carry per-session generated ids, not the program's fixture
    // ids, so address the first row rather than naming one.
    // Day 3 opens on Leg extension, a movement with a licensed illustration.
    await enterWorkout(page, { day: "Day 3" });
    const row = page.locator("#woDayTitle [data-exopen]").first();
    await row.scrollIntoViewIfNeeded({ timeout: 20000 });
    await row.click({ timeout: 20000 });
    await sleep(page, 800);
  },
  "library/exercise-detail-glossary": async (page) => {
    // Day 3 opens on Leg extension, a movement with a licensed illustration.
    await enterWorkout(page, { day: "Day 3" });
    const row = page.locator("#woDayTitle [data-exopen]").first();
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
    await openEditorA(page);
    // The installed editor is the canonical program-editing surface (Plan 074,
    // candidate A). Keep the historical catalog key so existing links and
    // committed frame paths stay stable while the scenario follows the editor.
    await sleep(page, 400);
  },
  "program/editor-alternates": async (page) => {
    await openProgram(page);
    await openEditorA(page);
    await openEditorSheetA(page, "seed-ex-1");
    const alternates = page.locator('#reviewSheet [data-role="alternates"][data-id="seed-ex-1"]');
    await alternates.waitFor({ timeout: 20000 });
    await alternates.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await sleep(page, 400);
  },
  "program/editor-suggest-loads": async (page) => {
    await openProgram(page);
    await openEditorA(page);
    // The slot becomes a movement that asks how it is done, through Swap → Search.
    await openEditorSheetA(page, "seed-ex-1");
    await page.locator('#reviewSheet [data-role="swap-open"]').click();
    await page.locator('#reviewSheet [data-role="swap-search"]').click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.fill("#exPickSearch", "Dumbbell renegade row");
    await page.locator('#exPickList [data-pick="3065c6f170d880d2bc77cba9edbf8ce9"]').click({ timeout: 20000 });
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 20000 });
    await editorIdleA(page);
    await openEditorSheetA(page, "seed-ex-1");
    await page.locator('#reviewSheet [data-role="suggest-loads"]').click();
    await editorIdleA(page);
    // From an empty RIR the stepper starts at 2: up then down lands on 2.
    await page.locator('#reviewSheet [data-role="suggest-loads-rir-step"][data-delta="1"]').click();
    await editorIdleA(page);
    await page.locator('#reviewSheet [data-role="suggest-loads-rir-step"][data-delta="-1"]').click();
    await editorIdleA(page);
    await page.waitForFunction(() => document.querySelector("#toast")?.classList.contains("hidden") !== false, undefined, { timeout: 20000 });
    const section = page.locator('#reviewSheet [data-role="loads"]');
    await section.locator('[data-role="execution-mode"]').first().waitFor({ timeout: 20000 });
    await section.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await sleep(page, 400);
  },
  "program/editor-day-name-refused": async (page) => {
    await openProgram(page);
    await openEditorA(page);
    const days = await page.locator('#programEditor [data-role="day-tab"]').evaluateAll((tabs) => tabs.map((tab) => tab.dataset.day));
    const firstName = await page.locator('#programEditor [data-role="day-tab"]').first().textContent();
    await page.locator(`#programEditor [data-role="day-tab"][data-day="${days[1]}"]`).click();
    await page.locator(`#programEditor [data-role="day-name-edit"][data-day="${days[1]}"]`).click();
    const input = page.locator('#reviewSheet.is-open [data-role="rename-input"]');
    await input.fill(firstName.trim());
    await input.press("Enter");
    await page.waitForSelector('#reviewSheet [data-role="rename-input"][aria-invalid="true"]', { timeout: 20000 });
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
    // The reopened sheet's form inherited whatever scrollTop the create pass
    // left behind, and that value tracked a focus-driven scrollIntoView raced
    // against web-font layout settling: the frame needs the "Deleting…"
    // button visible near the bottom, so pin the scroll to its true maximum
    // (after fonts settle) rather than resetting it to the top.
    await pinSheetScrollToEnd(page, "#exCustomSheet .custom__form");
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
  "program/share-too-large": async (page) => {
    // An edited program generated before the last generator bump (073.4): its
    // recipe no longer regenerates, so neither the recipe nor recipe-plus-edits
    // (#527) can carry it, and its full definition exceeds the link cap, so the
    // sheet offers the file.
    await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.() &&
      typeof window.__repforgeFinalizeProgramSetup === "function", undefined, { timeout: 15000 });
    await page.evaluate(async () => {
      const catalog = window.RepForgeExerciseCatalog.snapshot();
      const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
        environment: { kind: "commercial_gym" },
      }, catalog).value;
      const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, { asVersion: "073.4" }).value;
      definition.days.find((day) => day.kind === "training").slots[0].setupNotes = "Rack at 7";
      const finalized = await window.__repforgeFinalizeProgramSetup({
        programDefinition: definition, name: "Edited generated block", answers: {}, destination: "log",
        origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
        entrySource: { route: "recommend", fingerprint: "catalog-share-too-large" },
      });
      if (!(finalized?.localOk || finalized?.idbOk)) throw new Error("share-too-large finalize failed");
      await window.__repforgeStorage.flush();
    });
    await openShare(page);
    await page.waitForSelector("#shareSetupFile:not(.hidden):not(:disabled)", { timeout: 20000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return !toast || toast.classList.contains("hidden");
    }, undefined, { timeout: 10000 });
    await sleep(page, 400);
  },
  // #525: See audit explains the overview's planned weekly total, read-only; the first muscle is open.
  "program/volume-audit": async (page) => {
    await openProgram(page);
    await page.click("#seeVolumeAudit");
    await page.waitForSelector("#volumeAuditSheet.is-open", { timeout: 20000 });
    await page.locator("#volumeAuditBody .volaudit__row").first().click();
    await page.waitForSelector("#volumeAuditBody .volaudit__muscle[open]", { timeout: 20000 });
    await page.evaluate(() => { document.querySelector("#volumeAuditBody").scrollTop = 0; });
    await sleep(page, 400);
  },
  "program/text-export": async (page) => {
    await openProgram(page);
    await page.click("#exportProgramText");
    await page.waitForSelector("#programTextSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "today/skipped": async page => {
    await dismissChrome(page); await page.locator('#todayExList [data-context-row]').first().click({ button: 'right' });
    await page.locator('#nativeContextMenu [data-menu-value="skip"]').click();
    await page.waitForSelector('#todayExList .is-skipped');
  },
  "today/context-menu": async page => {
    await dismissChrome(page);
    await page.locator('#todayExList [data-context-row]').first().click({ button: 'right' });
    await page.waitForSelector('#nativeContextMenu[open]');
  },
  "workout/actions": async page => {
    await focusMode(page); await page.click('#woOverflowBtn');
    await page.waitForSelector('#workoutActionSheet.is-open');
  },
  "program/editor-context-menu": async page => {
    await openProgram(page); await openEditorA(page); await editorSheetAtRest(page);
    await editorRowMenuForCapture(page, '#programEditor [data-row-menu]');
  },
  "program/editor-alternate-context-menu": async page => {
    await openProgram(page); await openEditorA(page); await editorSheetAtRest(page); await openEditorSheetA(page, "seed-ex-1");
    await editorRowMenuForCapture(page, '#reviewSheet [data-role="alternate"] [data-row-menu]');
  },
  "settings/rest-controls": async page => {
    await openSettings(page); await page.click('#restSecRow');
    await page.locator('#restSecPanel').scrollIntoViewIfNeeded();
  },
  "settings/load-controls": async page => {
    await openSettings(page); await page.click('#progressionRow');
    await page.locator('#minJumpRow').scrollIntoViewIfNeeded();
  },
  "settings/main": (page) => openSettings(page),
  // Language as a native pull-down anchored to its row (the prototype, owner 2026-10-28), the current one checked.
  "settings/language-menu": async (page) => {
    await openSettings(page, "#langRow");
    await page.click("#langRow");
    await page.waitForSelector('#nativeContextMenu[open] [role="menuitemradio"][aria-checked="true"]');
    await sleep(page, 400);
  },
  "settings/appearance": (page) => openSettings(page, "#themeSegments"),
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
    await disclosureSettled(page);
    // The click that opened the panel may auto-scroll. Put the replayed guide's Privacy action at the centre of the
    // frame, so the dialog is placed on it the same way every run.
    await page.locator("#privacyDetails").evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
    await page.locator('#guideReplayList [data-guide-replay="privacy"]').click();
    await page.waitForFunction(() => !!document.querySelector('dialog#guideDialog[open][data-guide="privacy"]'), undefined, { timeout: 20000 });
    await sleep(page, 400);
  },
  "settings/backup-guide": async (page) => {
    await openSettings(page, "#dataBackupRow");
    await page.click("#dataBackupRow");
    await page.waitForSelector("#dataBackupPanel.is-open", { timeout: 20000 });
    await disclosureSettled(page);
    await page.locator("#exportJson").evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
    await sleep(page, 300);
    await replayGuide(page, "backup");
  },
  "settings/install-guide": async (page) => {
    // Settings offers Install on iOS Safari (APP_USER_AGENT), which is where its guide is met.
    await openSettings(page);
    await page.locator("#installApp").evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
    await sleep(page, 300);
    await replayGuide(page, "install");
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
].map((id) => [`install/${id}`, IOS_SAFARI]).concat([["settings/install-guide", IOS_SAFARI]]));
