#!/usr/bin/env node
/** Plan 057-P7 / Plan 064 R3k / Plan 067: Program roles, the ledger overview with no readiness route, its adaptive
 *  next-load column, and editor dock clearance. */
import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
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
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, "program-actions").value;
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
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
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
      return {
        theme,
        replace: (() => {
          const button = document.querySelector('#programEditor [data-role="replace"]');
          return button ? { role: button.dataset.actionRole || "", contrast: contrast(rgb(getComputedStyle(button).color), background(button)) } : null;
        })(),
        remove: (() => {
          const button = document.querySelector('#programEditor [data-role="remove-exercise"]');
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
  await page.click("#seeVolumeAudit");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden) #programEditor [data-role=\"editor\"]", { timeout: 5000 });
  check(await page.locator("#programOverview.is-hidden").count() === 1, "effective-set action enters the installed Program editor");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });

  await page.click("#programEditToggle");
  await page.waitForSelector('#programEditor [data-role="editor"]', { timeout: 5000 });
  const row = page.locator('#programEditor [data-role="exercise"]').first();
  if (!(await row.locator('[data-role="replace"]').count())) await row.locator('[data-role="toggle-exercise"]').click();
  await page.waitForSelector('#programEditor [data-role="replace"]', { timeout: 5000 });
  const roles = await page.evaluate(() => ({
    toggles: [...document.querySelectorAll('#programEditor [data-role="toggle-day"], #programEditor [data-role="toggle-exercise"]')]
      .map((button) => button.getAttribute("aria-expanded")),
    replace: document.querySelector('#programEditor [data-role="replace"]')?.dataset.actionRole || "",
    remove: document.querySelector('#programEditor [data-role="remove-exercise"]')?.dataset.actionRole || "",
    dockRole: document.querySelector("#program nav")?.dataset.elevation || document.querySelector("body:has(#program.program-editor-installed) nav")?.dataset.elevation || "",
    dockShadow: getComputedStyle(document.querySelector("body:has(#program.program-editor-installed) nav")).boxShadow,
  }));
  check(roles.toggles.length > 0 && roles.toggles.every((value) => value === "true" || value === "false"),
    "editor expansion controls expose aria-expanded", roles.toggles);
  const zeroEditorText = await page.locator("#programMeta").textContent();
  check(!/0\s*\/\s*\d+\s*(ready|prontos)/i.test(zeroEditorText || ""),
    "zero readiness renders no editor readiness chip", zeroEditorText);
  check(roles.replace === "replacement" && roles.remove === "removal",
    "Replace and Remove expose distinct semantic action roles", roles);
  check(roles.dockRole === "persistent-action" && roles.dockShadow !== "none",
    "installed editor dock exposes persistent-action elevation", roles);
  const contrast = await contrastSnapshot(page);
  for (const surface of contrast) {
    check(surface.replace?.role === "replacement" && surface.remove?.role === "removal" &&
      surface.replace.contrast >= 4.5 && surface.remove.contrast >= 4.5,
    `${surface.theme} Replace/Remove roles remain distinguishable and AA`, surface);
  }
  const clearance = await page.evaluate(() => {
    const last = [...document.querySelectorAll('#programEditor [data-role="exercise"]')].at(-1);
    const dock = document.querySelector("body:has(#program.program-editor-installed) nav");
    window.scrollTo(0, document.scrollingElement?.scrollHeight || document.documentElement.scrollHeight);
    const row = last?.getBoundingClientRect(), bar = dock?.getBoundingClientRect();
    return row && bar ? { rowBottom: row.bottom, dockTop: bar.top, viewport: innerHeight, clear: row.bottom <= bar.top + 1 } : null;
  });
  check(clearance?.clear === true, "the last editor row clears the persistent dock at scroll end", clearance);
  await page.click("#programEditToggle");
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
} finally {
  await context.close();
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  assert.fail(failures.join("; "));
}
