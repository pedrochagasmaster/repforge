#!/usr/bin/env node
/** Plan 057-P7 / Plan 064 R3k / Plan 067: Program roles, the ledger overview with no readiness route, its adaptive
 *  next-load column, and editor dock clearance. */
import assert from "node:assert/strict";
import { cancelInstalledEditor, closeEditorSheet, editorSettled, openExerciseSheet, openInstalledEditor } from "./fixtures/installed-editor.mjs";
import { launchChromium, openShelfField } from "./browser.mjs";
import { installSeedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function ymd(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function persist(page, state) {
  await page.evaluate(async ({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function install(page, log) {
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
  await persist(page, {
    ...state,
    programMeta: seedProgramMeta({ started: ymd(-14), id: "program-actions" }),
    log,
  });
}

async function openProgram(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

/** A real generated program, activated through the production finalize path. */
async function installGeneratedProgram(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  return page.evaluate(async ({ weight, reps }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4,
      sessionMinutes: 60, environment: { kind: "commercial_gym" },
    }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog).value;
    const found = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]));
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Program actions", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "program-actions" },
    });
    await window.__repforgeStorage.flush();
    return found ? { day: found.day.name, slotId: found.slot.id,
      sets: found.slot.prescriptionsByCycle[0].sets.length } : null;
  }, { weight: WEIGHT, reps: REPS });
}

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`);
  await input.fill(String(value));
}

/** Logs every set of the target's first slot through the focus shelf, then finishes early. */
async function performSession(page, target, { load, reps, rir }) {
  await page.click('nav button[data-view="log"]');
  await page.waitForSelector("#log.view.active", { timeout: 5000 });
  if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not enter day");
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  for (let ordinal = 1; ordinal <= target.sets; ordinal++) {
    await fillShelf(page, WEIGHT, load);
    await fillShelf(page, REPS, reps);
    const rirInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${target.slotId}_${ordinal}_rir"]`);
    if (await rirInput.getAttribute("aria-hidden") === "true")
      await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
    await rirInput.fill(String(rir));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator(`#workout .exercise.is-current [data-save="${target.slotId}_${ordinal}"]`).click();
    await page.waitForFunction(({ slotId, ordinal }) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
      const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
      return typeof exercise?.sets?.[setId]?.completion === "object";
    }, { slotId: target.slotId, ordinal }, { timeout: 15000 });
  }
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
}

/** The program rows whose recommendation carries a next load, in program order. */
async function nextLoadOracle(page) {
  return page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const program = state.program || [];
    const loaded = program.map((exercise) => ({ exercise, rec: window.__repforgeRecommendation(exercise) }))
      .filter(({ rec }) => rec.status !== "manual" && rec.load != null && Number.isFinite(+rec.load))
      .map(({ exercise, rec }) => ({ id: exercise.id, load: rec.load, text: String(rec.load) }));
    return { total: program.length, loaded };
  }, KEY);
}

async function contrastSnapshot(page) {
  return page.evaluate(() => {
    const channel = (value) => {
      const n = value / 255;
      return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    const contrast = (foreground, background) => {
      const a = luminance(foreground), b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const rgb = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return parts.length >= 3 && (parts[3] === undefined || parts[3] > 0) ? parts.slice(0, 3) : null;
    };
    const background = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const color = rgb(getComputedStyle(current).backgroundColor);
        if (color) return color;
      }
      return rgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    };
    return ["light", "dark"].map((theme) => {
      window.__repforgeUi.setTheme(theme);
      // Buttons ease their background between themes; measure where they land.
      for (const animation of document.getAnimations()) animation.finish();
      return {
        theme,
        replace: (() => {
          const button = document.querySelector('#reviewSheet [data-role="swap-open"]');
          return button ? { role: button.dataset.actionRole || "", contrast: contrast(rgb(getComputedStyle(button).color), background(button)) } : null;
        })(),
        remove: (() => {
          const button = document.querySelector('#reviewSheet [data-role="remove-exercise"]');
          return button ? { role: button.dataset.actionRole || "", contrast: contrast(rgb(getComputedStyle(button).color), background(button)) } : null;
        })(),
      };
    });
  });
}

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
  timezoneId: "UTC",
});
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  console.log("Program action roles");
  await install(page, []);
  await openProgram(page);
  const overview = await page.evaluate(() => ({
    days: [...document.querySelectorAll("#programOverview .prog-day")].map((day) => ({
      rows: day.querySelectorAll(".rxrow").length,
      collapsible: day.querySelectorAll("[aria-expanded]").length,
      role: [...day.querySelectorAll(".rxrow")].map((row) => row.dataset.actionRole || ""),
    })),
    readyLink: document.querySelector("#programReadyLink")?.textContent.trim() || null,
    readyStats: [...document.querySelectorAll("#programOverview .statrow__cell, #programMeta .pmeta__chip")]
      .map((cell) => cell.textContent.trim())
      .filter((text) => /ready/i.test(text)),
    up: document.querySelectorAll("#programOverview .verdictmark--up").length,
    reviewRole: document.querySelector("#reviewBlockLink")?.dataset.actionRole || "",
    volumeAuditAction: Boolean(document.querySelector("#seeVolumeAudit")),
  }));
  check(overview.days.length > 0 && overview.days.every((day) =>
    day.rows > 0 && day.collapsible === 0 && day.role.every((role) => role === "navigation")),
  "overview days are always open and each exercise row navigates", overview.days);
  check(!overview.readyLink && overview.readyStats.length === 0 && overview.up === 0,
    "zero readiness renders no ready action, 0-ready chip or up verdict", overview);
  check(overview.reviewRole === "navigation", "Review block is marked as navigation", overview.reviewRole);
  check(overview.volumeAuditAction, "effective-set audit action remains in Program overview", overview);
  // Refinement audit A8: the progression method most lifts use is named once, under the first day; a row names its
  // method only where it differs.
  const methods = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#programOverview .rxrow")];
    const names = [...prog.days()].flatMap((day) => prog.forDay(day)).map(programStrategyName);
    const counts = new Map(); names.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { common, lines: [...document.querySelectorAll("#programOverview .prog-legend--method")].map((el) => el.textContent.trim()),
      subs: rows.map((row) => row.querySelector(".rxrow__sub")?.textContent.trim() || "") };
  });
  check(methods.lines.length === 1 && methods.lines[0].includes(methods.common) && methods.subs.every((sub) => sub !== methods.common),
    "the usual progression method is named once, and rows name only a method that differs", methods);
  // #525: "See audit" opens a read-only explanation of the planned weekly total, never the editor.
  const storedBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const scrollBefore = await page.evaluate(() => { document.querySelector("#seeVolumeAudit").scrollIntoView({ block: "center" }); return scrollY; });
  await page.click("#seeVolumeAudit");
  await page.waitForSelector("#volumeAuditSheet.is-open", { timeout: 5000 });
  const audit = await page.evaluate(() => {
    const num = (text) => Number(String(text).replace(/[^\d.,-]/g, "").replace(",", "."));
    const muscles = [...document.querySelectorAll("#volumeAuditBody .volaudit__muscle")].map((el) => {
      const split = el.querySelector(".volaudit__split").textContent.match(/\d+(?:[.,]\d+)?/g).map(num);
      return { name: el.querySelector(".volaudit__name").firstChild.textContent, total: num(el.querySelector(".volaudit__n").textContent), split,
        from: [...el.querySelectorAll(".volaudit__calc")].map((c) => num(c.textContent.split("=").pop())) };
    });
    // The engine's own count per muscle, as prog.volume() returns it: direct sets in full, secondary credit at ½.
    const engine = [...prog.volume()].filter(([, v]) => v.d + v.p > 0).map(([muscle, v]) => ({ name: muscleLabel(muscle), total: v.d + v.p, direct: v.d, secondarySets: v.p * 2 }));
    return { engine, overview: document.querySelector("#seeVolumeAudit .listrow__title").textContent.trim(),
      total: document.querySelector("#volumeAuditBody .volaudit__total")?.textContent.trim(),
      method: document.querySelector("#volumeAuditBody .volaudit__method")?.textContent || "", muscles,
      editor: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") || !!document.querySelector("#program.program-editor-installed"),
      label: document.querySelector("#volumeAuditSheet").getAttribute("aria-labelledby"), title: document.querySelector("#volumeAuditTitle")?.textContent };
  });
  const sum = (list) => Math.round(list.reduce((a, b) => a + b, 0) * 100) / 100;
  check(!audit.editor && audit.title === "Planned weekly volume" && audit.label === "volumeAuditTitle",
    "See audit opens the planned weekly volume sheet, not the editor (#525)", audit);
  check(audit.total === audit.overview && sum(audit.muscles.map((m) => m.total)) === Number(audit.overview.match(/[\d.]+/)[0]),
    "the sheet's total is the overview's, and the muscles add up to it exactly", { overview: audit.overview, total: audit.total, muscles: audit.muscles.map((m) => m.total) });
  // The row states its parts in sets: direct sets count in full and secondary sets at ½, and they compute to its figure.
  check(audit.muscles.length > 0 && audit.muscles.every((m) => m.split.length === 2 && m.split[0] + m.split[1] * 0.5 === m.total && sum(m.from) === m.total),
    "each muscle's stated parts (direct sets + secondary sets × ½), and the exercises it comes from, compute to its count", audit.muscles);
  const byName = new Map(audit.engine.map((e) => [e.name, e]));
  check(audit.engine.length === audit.muscles.length && audit.muscles.every((m) => { const e = byName.get(m.name);
    return e && e.total === m.total && e.direct === m.split[0] && e.secondarySets === m.split[1]; }),
    "every muscle's figure and parts are the engine's own (prog.volume()), not a second calculation", { engine: audit.engine, muscles: audit.muscles });
  check(/half/.test(audit.method) && /more than the number of sets/.test(audit.method), "the sheet says how the count is made and that it is not a count of sets", audit.method);
  await page.locator("#volumeAuditBody .volaudit__row").first().click();
  check(await page.locator("#volumeAuditBody .volaudit__muscle[open] .volaudit__from li").count() > 0, "a muscle opens to the exercises its count comes from");
  const empty = await page.evaluate(() => { const keep = prog.exercises; prog.exercises = []; try { return volumeAuditHtml(); } finally { prog.exercises = keep; } });
  check(/No sets are planned yet/.test(empty) && !/volaudit__total/.test(empty), "with nothing planned the sheet says so plainly", empty);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#volumeAuditSheet", { state: "hidden", timeout: 5000 });
  const back = await page.evaluate((key) => ({ focus: document.activeElement?.id, scroll: scrollY, stored: localStorage.getItem(key),
    overview: !document.querySelector("#programOverview").classList.contains("is-hidden"),
    editor: !!document.querySelector("#program.program-editor-installed") }), KEY);
  check(back.focus === "seeVolumeAudit" && back.overview && !back.editor && Math.abs(back.scroll - scrollBefore) < 2 && back.stored === storedBefore,
    "closing returns to the overview at its place with focus on See audit, nothing edited or stored", { ...back, stored: back.stored === storedBefore, scrollBefore });

  await openInstalledEditor(page);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#programEditor [data-role="day-tab"]')]
    .map((tab) => tab.getAttribute("aria-selected")));
  const firstRow = await page.locator('#programEditor [data-role="exercise-row"]').first().getAttribute("data-id");
  await openExerciseSheet(page, firstRow);
  const roles = await page.evaluate(() => ({
    replace: document.querySelector('#reviewSheet [data-role="swap-open"]')?.dataset.actionRole || "",
    remove: document.querySelector('#reviewSheet [data-role="remove-exercise"]')?.dataset.actionRole || "",
    dockRole: document.querySelector('#programEditor [data-role="apply-bar"]')?.dataset.elevation || "",
    dockShadow: getComputedStyle(document.querySelector('#programEditor [data-role="apply-bar"]')).boxShadow,
  }));
  check(tabs.length > 0 && tabs.filter((value) => value === "true").length === 1 && tabs.every((value) => value === "true" || value === "false"),
    "the editor's day tabs expose aria-selected, one at a time", tabs);
  const zeroEditorText = await page.locator("#programMeta").textContent();
  check(!/0\s*\/\s*\d+\s*(ready|prontos)/i.test(zeroEditorText || ""),
    "zero readiness renders no editor readiness chip", zeroEditorText);
  check(roles.replace === "replacement" && roles.remove === "removal",
    "Replace and Remove expose distinct semantic action roles", roles);
  check(roles.dockRole === "persistent-action" && roles.dockShadow !== "none",
    "the editor's pinned Apply exposes persistent-action elevation", roles);
  const contrast = await contrastSnapshot(page);
  for (const surface of contrast) {
    check(surface.replace?.role === "replacement" && surface.remove?.role === "removal" &&
      surface.replace.contrast >= 4.5 && surface.remove.contrast >= 4.5,
    `${surface.theme} Replace/Remove roles remain distinguishable and AA`, surface);
  }
  await closeEditorSheet(page);
  // The editor is a page sheet (ADR 0023): it scrolls in #programEditorWrap, and its bottom bar shows only a blocked reason.
  const clearance = await page.evaluate(() => {
    const last = [...document.querySelectorAll('#programEditor [data-role="exercise-row"], #programEditor [data-role="add-exercise"]')].at(-1);
    const wrap = document.querySelector("#programEditorWrap"), dock = document.querySelector('#programEditor [data-role="apply-bar"]');
    wrap.scrollTo(0, wrap.scrollHeight);
    const row = last?.getBoundingClientRect(), box = wrap.getBoundingClientRect(), bar = dock?.getBoundingClientRect();
    const barShown = !!bar && bar.height > 0 && getComputedStyle(dock).display !== "none";
    const limit = Math.min(box.bottom, innerHeight, barShown ? bar.top : Infinity);
    return row ? { rowBottom: row.bottom, limit, barShown, clear: row.bottom <= limit + 1 } : null;
  });
  check(clearance?.clear === true, "the day's last control is in view at the end of the editor sheet's scroll, clear of any pinned bar", clearance);
  await cancelInstalledEditor(page);
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });

  console.log("\nProgram readiness is retired; the next column carries the adaptive recommendation");
  const target = await installGeneratedProgram(page);
  if (!target) throw new Error("the generated program has no weighted first slot");
  await performSession(page, target, { load: 100, reps: 8, rir: 2 });
  await openProgram(page);
  const oracle = await nextLoadOracle(page);
  const rows = await page.evaluate(() => ({
    readyRoute: document.querySelectorAll("#programReadyLink, #programReadyBack, [data-ready-ex]").length,
    positiveChips: [...document.querySelectorAll("#programMeta .pmeta__chip")]
      .filter((node) => /ready|pronto/i.test(node.textContent || "")).length,
    targets: [...document.querySelectorAll("#programOverview [data-parity-target]")]
      .map((node) => ({ id: node.dataset.parityTarget, text: node.textContent.trim() })),
  }));
  check(oracle.loaded.some((entry) => entry.id === target.slotId),
    "the performed movement carries an adaptive next load from its recommendation", { oracle, target });
  check(oracle.loaded.length < oracle.total,
    "movements without history carry no recommended load", oracle);
  check(rows.readyRoute === 0 && rows.positiveChips === 0,
    "no Program readiness route, link or chip exists", rows);
  check(JSON.stringify(rows.targets.map((entry) => entry.id)) === JSON.stringify(oracle.loaded.map((entry) => entry.id)),
    "the next column shows a load for exactly the recommendation-owned exercises, in program order", { rows, oracle });
  check(oracle.loaded.every((entry) => rows.targets.find((row) => row.id === entry.id)?.text.includes(entry.text)),
    "every shown next load is the load its recommendation computes", { rows, oracle });
  await page.click("#reviewBlockLink");
  await page.waitForSelector('#stats.view.active #statsSeg button[data-seg="review"].active', { timeout: 5000 });
  check(await page.locator("#stats.view.active").count() === 1, "Review block routes through Progress Review", await page.locator("#stats.view.active").count());

  // #526: the Started date field stays inside the Program gutters, aligned with Program name, at every phone width,
  // at 200% text and in Portuguese, and no ancestor clips it. iOS gives a native date field an intrinsic width wider
  // than the column, so it drops the native appearance as the Session details date field does.
  console.log("Program Started field geometry (#526)");
  await openProgram(page);
  const started = [];
  for (const lang of ["en", "pt"]) {
    await page.evaluate(async (lang) => { document.querySelector("#lang").value = lang; settingsEditRevision++; await commitSettings(true); renderProgram(); }, lang);
    for (const width of [320, 390, 430]) for (const scale of [1, 2]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate((scale) => { document.documentElement.style.fontSize = scale === 1 ? "" : `${scale * 100}%`; renderProgram(); }, scale);
      started.push(await page.evaluate(({ lang, width, scale }) => {
        const input = document.querySelector("#programStarted"), name = document.querySelector(".pmeta__name input");
        input.scrollIntoView({ block: "center" });
        const box = input.getBoundingClientRect(), gutter = name.getBoundingClientRect();
        const clippedBy = [];
        for (let el = input.parentElement; el && el !== document.documentElement; el = el.parentElement) {
          const cs = getComputedStyle(el);
          if (cs.overflowX === "visible") continue;
          const r = el.getBoundingClientRect();
          if (box.left < r.left - 0.5 || box.right > r.right + 0.5) clippedBy.push(el.id || el.className);
        }
        return { lang, width, scale, left: box.left, right: box.right, nameLeft: gutter.left, nameRight: gutter.right, vw: innerWidth,
          appearance: getComputedStyle(input).appearance, value: input.value, clippedBy, docLang: document.documentElement.lang };
      }, { lang, width, scale }));
    }
  }
  await page.evaluate(async () => { document.documentElement.style.fontSize = ""; document.querySelector("#lang").value = "en"; settingsEditRevision++; await commitSettings(true); });
  await page.setViewportSize({ width: 390, height: 844 });
  const misplaced = started.filter((r) => Math.abs(r.left - r.nameLeft) > 0.5 || Math.abs(r.right - r.nameRight) > 0.5 || r.right > r.vw - 16 + 0.5 || r.clippedBy.length);
  check(started.every((r) => r.docLang.startsWith(r.lang)), "the geometry runs in each language", started.map((r) => r.docLang));
  check(started.length === 12 && misplaced.length === 0,
    "the Started field sits wholly inside the gutters, aligned with Program name, unclipped, at 320/390/430, 100%/200% text, EN/PT", misplaced.length ? misplaced : started.slice(0, 2));
  check(started.every((r) => r.appearance === "none" && /^\d{4}-\d{2}-\d{2}$/.test(r.value)),
    "the Started field drops iOS's native date appearance and keeps its date", started.map((r) => `${r.appearance}:${r.value}`));
} finally {
  await context.close();
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  assert.fail(failures.join("; "));
}
