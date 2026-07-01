#!/usr/bin/env node
/**
 * RepForge year-of-usage browser simulation.
 * Run: node test/simulation.mjs
 * Requires: python3 -m http.server 8000 serving /workspace
 */

import { chromium } from "playwright";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0, bugs: [] };

function pass(name) {
  results.passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail, repro) {
  results.failed++;
  results.bugs.push({ name, detail, repro });
  console.log(`  ✗ ${name}`);
  console.log(`    ${detail}`);
  if (repro) console.log(`    Repro: ${repro}`);
}

function assert(cond, name, detail, repro) {
  if (cond) pass(name);
  else fail(name, detail, repro);
}

async function getState(page) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw);
    return null;
  }, KEY);
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 10000 });
}

async function getProgramExercises(page, day) {
  await selectDay(page, day);
  return page.evaluate(() => {
    const map = new Map();
    document.querySelectorAll("#workout input[data-k]").forEach((inp) => {
      const m = inp.dataset.k.match(/^(.+)_(\d+)_(load|reps|rir)$/);
      if (!m) return;
      const [, id, setNum] = m;
      if (!map.has(id)) map.set(id, { id, sets: 0 });
      map.get(id).sets = Math.max(map.get(id).sets, +setNum);
    });
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  });
}

async function clearState(page) {
  await page.evaluate(({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
  }, { k: KEY, d: DRAFT });
}

async function nav(page, view) {
  await page.click(`nav button[data-view="${view}"]`);
  await page.waitForTimeout(80);
}

async function selectDay(page, dayName) {
  await page.click(`#dayTabs button[data-day="${dayName}"]`);
  await page.waitForTimeout(60);
}

async function fillExerciseSets(page, exId, sets, load, reps, rir) {
  for (let n = 1; n <= sets; n++) {
    const loadSel = `[data-k="${exId}_${n}_load"]`;
    const repsSel = `[data-k="${exId}_${n}_reps"]`;
    const rirSel = `[data-k="${exId}_${n}_rir"]`;
    if (await page.locator(loadSel).count()) {
      await page.fill(loadSel, String(load));
      await page.fill(repsSel, String(reps));
      await page.fill(rirSel, String(rir));
    }
  }
}

async function saveWorkout(page) {
  await page.click(".btn--save");
  await page.waitForTimeout(250);
}

async function getExerciseMeta(page, day) {
  await selectDay(page, day);
  return page.evaluate(() =>
    [...document.querySelectorAll("#workout .exercise")].map((article) => {
      const meta = article.querySelector(".ex__meta")?.textContent || "";
      const range = meta.match(/×(\d+)-(\d+)/);
      const setsMatch = meta.match(/^(\d+)×/);
      let id = null;
      article.querySelectorAll("input[data-k]").forEach((inp) => {
        const m = inp.dataset.k.match(/^(.+)_\d+_/);
        if (m) id = m[1];
      });
      return {
        id,
        sets: setsMatch ? +setsMatch[1] : 2,
        min: range ? +range[1] : 4,
        max: range ? +range[2] : 8,
      };
    })
  );
}

async function cardInfo(page, idx) {
  return page.evaluate((i) => {
    const a = document.querySelectorAll("#workout .exercise")[i];
    if (!a) return null;
    return {
      status: [...a.classList].find((c) => c.startsWith("is-") && c !== "is-collapsed") || "",
      chip: a.querySelector(".chip")?.textContent || "",
      rec: a.querySelector(".rec")?.textContent || "",
      setup: a.querySelector(".setup")?.textContent || "",
      collapsed: a.classList.contains("is-collapsed"),
    };
  }, idx);
}

function isoDateFromWeeksAgo(weeksAgo) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("RepForge year-of-usage simulation");
  console.log(`Target: ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await clearState(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForApp(page);

  // ── Phase 1: 52 weeks of varied workout logging ──────────────────
  console.log("Phase 1: Year of workout logging (52 weeks)");

  const days = ["Day 1", "Day 2", "Day 3"];
  let sessionCount = 0;

  for (let week = 0; week < 52; week++) {
    const day = days[week % 3];
    const date = isoDateFromWeeksAgo(51 - week);
    // Align to step=0.5 — values like 61.25 fail HTML5 validation and block save silently
    const loadBase = Math.round((60 + week * 1.25) * 2) / 2;
    const reps = 6 + (week % 3);
    const rir = week % 4 === 0 ? 2 : 1;

    await nav(page, "log");
    await selectDay(page, day);
    await page.fill("#date", date);

    const exs = await getProgramExercises(page, day);
    // Log first 2 exercises fully, leave rest as defaults (varied data)
    for (let i = 0; i < Math.min(2, exs.length); i++) {
      const ex = exs[i];
      await fillExerciseSets(page, ex.id, ex.sets, loadBase + i * 5, reps, rir);
    }

    // Week 10: edge case — zero load on first set
    if (week === 10) {
      await page.fill(`[data-k="${exs[0].id}_1_load"]`, "0");
      await page.fill(`[data-k="${exs[0].id}_1_reps"]`, "0");
    }

    // Week 20: empty kg fields (cleared)
    if (week === 20) {
      await page.fill(`[data-k="${exs[0].id}_1_load"]`, "");
    }

    await saveWorkout(page);
    sessionCount++;
  }

  // Multiple sessions same day (use a date not in the 52-week loop)
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const sameDay = "2018-03-20";
  await page.fill("#date", sameDay);
  const d1Exs = await getProgramExercises(page, "Day 1");
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await saveWorkout(page);
  sessionCount++;

  await page.fill("#date", sameDay);
  await fillExerciseSets(page, d1Exs[1].id, d1Exs[1].sets, 50, 10, 0);
  await saveWorkout(page);
  sessionCount++;

  let state = await getState(page);
  const uniqueSessions = new Set(state.log.map((x) => x.session)).size;
  assert(
    uniqueSessions >= 52,
    "52+ unique sessions logged",
    `Expected ≥52 sessions, got ${uniqueSessions}`,
    "Log tab → save workouts across 52 weeks"
  );

  const sameDaySessions = [
    ...new Set(state.log.filter((x) => x.date === sameDay).map((x) => x.session)),
  ];
  assert(
    sameDaySessions.length >= 2,
    "Multiple sessions on same day",
    `Expected 2+ sessions on ${sameDay}, got ${sameDaySessions.length}`,
    `Log tab → set date to ${sameDay} → save twice`
  );

  const zeroLoadRows = state.log.filter((x) => x.load === 0);
  assert(
    zeroLoadRows.length === 0,
    "Zero-load sets are not persisted",
    `Found ${zeroLoadRows.length} zero-load rows — empty sets should be skipped on save`,
    "Log tab → enter 0 kg on a set → Save workout → row should not appear in log"
  );

  // ── Phase 2: Draft persistence ───────────────────────────────────
  console.log("\nPhase 2: Draft persistence");

  await nav(page, "log");
  await selectDay(page, "Day 2");
  const d2Exs = await getProgramExercises(page, "Day 2");
  const draftEx = d2Exs[0];
  const draftLoad = "137.5";
  await page.fill(`[data-k="${draftEx.id}_1_load"]`, draftLoad);
  await page.fill(`[data-k="${draftEx.id}_1_reps"]`, "7");
  await page.waitForTimeout(100);

  const draftBefore = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(
    draftBefore && draftBefore.includes(draftLoad),
    "Draft saved to localStorage on input",
    `Draft missing expected load ${draftLoad}`,
    "Log tab → type kg value → check localStorage repforge_draft_v1"
  );

  await page.reload({ waitUntil: "networkidle" });
  await nav(page, "log");
  await selectDay(page, "Day 2");
  const restoredLoad = await page.inputValue(`[data-k="${draftEx.id}_1_load"]`);
  assert(
    restoredLoad === draftLoad,
    "Draft restored after reload",
    `Expected ${draftLoad}, got "${restoredLoad}"`,
    "Log tab → enter values → reload page → values should persist unsaved"
  );

  // Saving clears draft
  await saveWorkout(page);
  const draftAfterSave = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(
    !draftAfterSave || draftAfterSave === "{}",
    "Draft cleared after save",
    `Draft still present: ${draftAfterSave?.slice(0, 80)}`,
    "Log tab → fill draft → Save workout → draft key should be empty"
  );

  // ── Phase 3: Switch days & verify tabs ───────────────────────────
  console.log("\nPhase 3: Day switching");

  await nav(page, "log");
  for (const d of days) {
    await selectDay(page, d);
    const active = await page.locator(`#dayTabs button.active`).textContent();
    assert(
      active === d,
      `Active tab is ${d}`,
      `Tab shows "${active}" instead of "${d}"`,
      `Log tab → click ${d} tab`
    );
    const workoutCount = await page.locator("#workout .exercise").count();
    const expected = (await getProgramExercises(page, d)).length;
    assert(
      workoutCount === expected,
      `${d} renders ${expected} exercises`,
      `Rendered ${workoutCount}, expected ${expected}`,
      `Log tab → select ${d}`
    );
  }

  // ── Phase 4: Program editing — rename, add, remove, reorder ──────
  console.log("\nPhase 4: Program editing");

  await nav(page, "program");

  // Rename Day 1
  const renameInput = page.locator('[data-act="renameDay"][data-day="Day 1"]');
  await renameInput.fill("Push Day");
  await renameInput.blur();
  await page.waitForTimeout(150);

  state = await getState(page);
  const hasPushDay = state.program.some((e) => e.day === "Push Day");
  const noDay1 = !state.program.some((e) => e.day === "Day 1");
  assert(
    hasPushDay && noDay1,
    "Rename day (Day 1 → Push Day)",
    `program days: ${[...new Set(state.program.map((e) => e.day))].join(", ")}`,
    "Program tab → rename Day 1 input → blur"
  );

  // Log tab should reflect renamed day
  await nav(page, "log");
  const tabText = await page.locator("#dayTabs").textContent();
  assert(
    tabText.includes("Push Day"),
    "Renamed day appears in log tabs",
    `Tabs: ${tabText}`,
    "Program tab → rename day → Log tab → check day tabs"
  );

  // Rename exercise (pick one that already has log history)
  await nav(page, "program");
  state = await getState(page);
  const loggedOnDay2 = state.log.find((x) => x.day === "Day 2");
  assert(loggedOnDay2, "Day 2 has log history before rename test", "No Day 2 log rows", "Phase 1 should log Day 2 sessions");
  const targetInput = page.locator(`.pex__name[value="${loggedOnDay2.name.replace(/"/g, '\\"')}"]`).first();
  const oldName = await targetInput.inputValue();
  const newName = "Custom Leg Press";
  await targetInput.fill(newName);
  await targetInput.blur();
  await page.waitForTimeout(100);

  state = await getState(page);
  assert(
    state.program.some((e) => e.name === newName),
    "Rename exercise persists",
    `Could not find "${newName}" in program`,
    "Program tab → edit exercise name field"
  );
  const renamedEx = state.program.find((e) => e.name === newName);
  const historyLinked =
    renamedEx && state.log.some((x) => x.exerciseId === renamedEx.id || x.name === oldName);
  assert(
    historyLinked,
    "Historical logs stay linked after exercise rename",
    `No log rows matched exerciseId or prior name "${oldName}"`,
    "Rename exercise → log entries should keep exerciseId or original name snapshot"
  );

  await nav(page, "log");
  await selectDay(page, "Day 2");
  const lastLine = await page
    .locator("#workout .exercise")
    .filter({ has: page.locator(`.ex__name:text-is("${newName}")`) })
    .locator(".prev")
    .textContent()
    .catch(() => "");
  assert(
    lastLine.includes("Last:"),
    "Renamed exercise still shows last session via exerciseId",
    `Expected Last: line after rename, got "${lastLine}"`,
    "Rename exercise → Log tab → previous session should still display"
  );

  // Add exercise
  await nav(page, "program");
  const exCountBefore = state.program.filter((e) => e.day === "Push Day").length;
  await page.click('[data-act="addEx"][data-day="Push Day"]');
  await page.waitForTimeout(100);
  state = await getState(page);
  const exCountAfter = state.program.filter((e) => e.day === "Push Day").length;
  assert(
    exCountAfter === exCountBefore + 1,
    "Add exercise to day",
    `Before ${exCountBefore}, after ${exCountAfter}`,
    "Program tab → + Add exercise on a day"
  );

  // Reorder — move second exercise down (swaps with third)
  const pushExs = state.program
    .filter((e) => e.day === "Push Day")
    .sort((a, b) => a.order - b.order);
  if (pushExs.length >= 3) {
    const secondId = pushExs[1].id;
    const thirdId = pushExs[2].id;
    await page.click(`button[data-act="down"][data-id="${secondId}"]`);
    await page.waitForTimeout(100);
    state = await getState(page);
    const reordered = state.program
      .filter((e) => e.day === "Push Day")
      .sort((a, b) => a.order - b.order);
    assert(
      reordered[1].id === thirdId && reordered[2].id === secondId,
      "Reorder exercise (move down swaps with below)",
      `Order: ${reordered.map((e) => e.name).join(", ")}`,
      "Program tab → ▼ on second exercise (should swap with third)"
    );
  }

  // Remove added exercise (last one named "New exercise")
  const newEx = state.program.find((e) => e.name === "New exercise" && e.day === "Push Day");
  if (newEx) {
    await page.click(`button[data-act="delEx"][data-id="${newEx.id}"]`);
    await page.waitForTimeout(100);
    state = await getState(page);
    assert(
      !state.program.find((e) => e.id === newEx.id),
      "Remove exercise",
      "Exercise still in program after delete",
      "Program tab → ✕ on exercise"
    );
  }

  // Add new day
  await page.click("#addDay");
  await page.waitForTimeout(100);
  state = await getState(page);
  const dayNames = [...new Set(state.program.map((e) => e.day))];
  assert(
    dayNames.some((d) => d.match(/^Day \d+$/)),
    "Add new training day",
    `Days: ${dayNames.join(", ")}`,
    "Program tab → + Add day"
  );

  // Duplicate day rename rejected
  const dupInput = page.locator('[data-act="renameDay"][data-day="Day 2"]');
  await dupInput.fill("Push Day");
  await dupInput.blur();
  await page.waitForTimeout(150);
  state = await getState(page);
  assert(
    state.program.some((e) => e.day === "Day 2"),
    "Duplicate day rename rejected",
    `Day 2 missing after duplicate rename attempt; days: ${[...new Set(state.program.map((e) => e.day))].join(", ")}`,
    "Program tab → rename Day 2 to existing Push Day → should revert"
  );

  // ── Phase 5: Delete sessions ─────────────────────────────────────
  console.log("\nPhase 5: Delete sessions");

  await nav(page, "history");
  const sessionsBefore = (await getState(page)).log.length;
  const delBtn = page.locator(".session__del").first();
  const delSessionId = await delBtn.getAttribute("data-del");
  await delBtn.click();
  await page.waitForTimeout(150);

  state = await getState(page);
  const sessionsAfter = state.log.length;
  const deletedGone = !state.log.some((x) => x.session === delSessionId);
  assert(
    sessionsAfter < sessionsBefore && deletedGone,
    "Delete session removes all its sets",
    `Before ${sessionsBefore} sets, after ${sessionsAfter}; session ${delSessionId} still present: ${!deletedGone}`,
    "History tab → Delete on a session → confirm"
  );

  // ── Phase 6: Settings ────────────────────────────────────────────
  console.log("\nPhase 6: Settings");

  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#settings details.advanced")?.setAttribute("open", ""));
  await page.fill("#jumpPct", "5");
  await page.fill("#minJump", "5");
  await page.fill("#rirHigh", "3");
  await page.click("#saveSettings");
  await page.waitForTimeout(100);

  state = await getState(page);
  assert(
    state.settings.jumpPct === 5 && state.settings.minJump === 5 && state.settings.rirHigh === 3,
    "Settings saved",
    JSON.stringify(state.settings),
    "Settings tab → change values → Save settings"
  );

  // Settings affect recommendations (add load when at max reps)
  await nav(page, "log");
  await selectDay(page, "Push Day");
  const pushFirst = (await getExerciseMeta(page, "Push Day"))[0];
  // Fill at max reps with high RIR to trigger add load
  await fillExerciseSets(page, pushFirst.id, pushFirst.sets, 200, pushFirst.max, 3);
  await saveWorkout(page);

  await nav(page, "log");
  await selectDay(page, "Push Day");
  const recText = await page.locator("#workout .exercise").first().locator(".rec").textContent();
  const hasAddLoad =
    recText.includes("Add load") || recText.includes("Add load ++") || recText.includes("Target");
  assert(
    hasAddLoad,
    "Recommendation reacts to settings + history",
    `Rec text: ${recText?.slice(0, 100)}`,
    "Settings → high jumpPct → log max reps → next session should recommend load increase"
  );

  // ── Phase 7: Stats integrity ─────────────────────────────────────
  console.log("\nPhase 7: Stats");

  await nav(page, "stats");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const d = document.querySelector("#statsDeep");
    if (d) d.open = true;
  });
  await page.waitForTimeout(150);

  const metricsText = await page.locator("#metrics").textContent();
  assert(
    metricsText.includes("Sessions") && metricsText.includes("Sets logged"),
    "Stats metrics render",
    metricsText?.slice(0, 120),
    "Stats tab → check metric tiles"
  );

  const statOptions = await page.locator("#statExercise option").count();
  assert(
    statOptions > 0,
    "Stats exercise dropdown populated",
    `Option count: ${statOptions}`,
    "Stats tab → exercise select"
  );

  // Chart should not throw on render
  const chartRendered = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c && c.width > 0;
  });
  assert(
    chartRendered,
    "Chart canvas renders with data",
    "Canvas width is 0 or missing",
    "Stats tab → select exercise with history"
  );

  const trendText = await page.locator("#trend").textContent();
  assert(
    trendText && trendText.length > 5,
    "Trend summary shows progression",
    `Trend: "${trendText}"`,
    "Stats tab → select logged exercise"
  );

  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(300);
  const okWide = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
  });
  await page.setViewportSize({ width: 380, height: 900 });
  await page.waitForTimeout(300);
  const okNarrow = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
  });
  assert(
    okWide && okNarrow,
    "Chart canvas tracks viewport width on resize",
    `wide=${okWide} narrow=${okNarrow}`,
    "Stats → resize viewport → canvas backing width follows clientWidth"
  );
  await page.setViewportSize({ width: 390, height: 844 });

  // ── Phase 8: Export JSON, modify, re-import ──────────────────────
  console.log("\nPhase 8: JSON export/import");

  await nav(page, "settings");
  const tmpDir = mkdtempSync(join(tmpdir(), "repforge-test-"));
  const jsonPath = join(tmpDir, "backup.json");

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportJson"),
  ]);
  await jsonDownload.saveAs(jsonPath);

  let exported;
  try {
    exported = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (e) {
    fail("JSON export is valid JSON", String(e), "Settings → Export backup JSON");
    exported = null;
  }
  if (exported) {
    assert(
      exported.program && Array.isArray(exported.log) && exported.settings,
      "JSON export has program/log/settings",
      `Keys: ${Object.keys(exported).join(", ")}`,
      "Settings → Export backup JSON → inspect file"
    );

    // Modify and re-import
    const modNote = "SIMULATION_MODIFIED";
    exported.log[0].notes = modNote;
    exported.settings.jumpPct = 7.5;
    writeFileSync(jsonPath, JSON.stringify(exported, null, 2));

    await page.setInputFiles("#importJson", jsonPath);
    await page.waitForTimeout(200);

    state = await getState(page);
    assert(
      state.settings.jumpPct === 7.5,
      "JSON import applies settings",
      `jumpPct=${state.settings.jumpPct}`,
      "Modify exported JSON settings → Import backup JSON"
    );
    assert(
      state.log.some((x) => x.notes === modNote),
      "JSON import applies log modifications",
      "Modified notes not found in imported log",
      "Modify exported JSON log entry → Import"
    );

    // Import without settings merges defaults
    const noSettingsPath = join(tmpDir, "no-settings.json");
    writeFileSync(
      noSettingsPath,
      JSON.stringify({ program: exported.program, log: exported.log.slice(0, 6) })
    );
    await page.setInputFiles("#importJson", noSettingsPath);
    await page.waitForTimeout(200);
    state = await getState(page);
    assert(
      state.settings.jumpPct === 2.5 && state.settings.minJump === 2.5 && state.settings.rirHigh === 2,
      "Import without settings uses defaults",
      JSON.stringify(state.settings),
      "Import backup JSON missing settings key"
    );
  }
  console.log("\nPhase 9: CSV export");

  const csvPath = join(tmpDir, "log.csv");
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportCsv"),
  ]);
  await csvDownload.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8");
  const csvLines = csv.trim().split("\n");
  assert(
    csvLines.length > 1,
    "CSV export has header + rows",
    `Lines: ${csvLines.length}`,
    "Settings → Export log CSV"
  );
  const header = csvLines[0];
  assert(
    header.includes("session") &&
      header.includes("date") &&
      header.includes("load") &&
      header.includes("reps") &&
      header.includes("exercise_id") &&
      header.includes("e1rm") &&
      header.includes("is_hard_set"),
    "CSV header has expected columns",
    `Header: ${header}`,
    "Settings → Export log CSV → check first line"
  );
  assert(
    csvLines.length - 1 === state.log.length,
    "CSV row count matches log length",
    `CSV data rows ${csvLines.length - 1}, log entries ${state.log.length}`,
    "Export CSV → compare row count to log"
  );

  // ── Phase 10: Program JSON editor ────────────────────────────────
  console.log("\nPhase 10: Program JSON editor");

  await nav(page, "program");
  await page.locator("#program details.advanced summary").click();
  const jsonArea = page.locator("#programJson");
  let progJson = JSON.parse(await jsonArea.inputValue());
  const testExName = "JSON Editor Test Lift";
  progJson.push({
    day: "Day 4",
    order: 1,
    name: testExName,
    sets: 3,
    min: 5,
    max: 10,
    primary: "Test",
    secondary: "",
  });
  await jsonArea.fill(JSON.stringify(progJson, null, 2));
  await page.click("#saveProgram");
  await page.waitForTimeout(150);

  state = await getState(page);
  assert(
    state.program.some((e) => e.name === testExName),
    "Program JSON editor saves new exercise",
    "Exercise not found after JSON save",
    "Program → Advanced → edit JSON → Save JSON"
  );

  // Invalid JSON toast
  await jsonArea.fill("{ invalid json");
  await page.click("#saveProgram");
  await page.waitForTimeout(200);
  const toastText = await page.locator("#toast").textContent();
  assert(
    toastText.includes("parse") || toastText.includes("JSON"),
    "Invalid program JSON shows error toast",
    `Toast: "${toastText}"`,
    "Program → Advanced → enter invalid JSON → Save JSON"
  );

  // JSON round-trip preserves exercise ids
  await nav(page, "program");
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  const before = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
  const firstId = before[0].id;
  assert(
    !!firstId,
    "Program JSON exposes exercise ids",
    "No id field in program JSON",
    "Program → Advanced → JSON shows id"
  );
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  await page.click("#saveProgram");
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
  assert(
    after[0].id === firstId,
    "JSON round-trip preserves exercise ids",
    `id changed ${firstId} → ${after[0].id}`,
    "Program → Save JSON with no edits → ids unchanged"
  );

  // ── Phase 11: Edge cases & invariants ────────────────────────────
  console.log("\nPhase 11: Edge cases");

  // Backdated date in UI
  await nav(page, "log");
  const backdate = "2020-01-15";
  await page.fill("#date", backdate);
  const logDay =
    (await page.locator('#dayTabs button[data-day="Day 2"]').count()) > 0
      ? "Day 2"
      : await page.locator("#dayTabs button").first().getAttribute("data-day");
  await selectDay(page, logDay);
  const d2 = await getExerciseMeta(page, logDay);
  await fillExerciseSets(page, d2[0].id, 1, 40, 10, 2);
  await saveWorkout(page);
  state = await getState(page);
  assert(
    state.log.some((x) => x.date === backdate),
    "Backdated session saved",
    `No log entry with date ${backdate}`,
    "Log tab → set date to past → Save workout"
  );

  // Session ID collision on rapid double-save (same millisecond)
  await nav(page, "log");
  await selectDay(page, logDay);
  const collisionDate = "2019-06-01";
  await page.fill("#date", collisionDate);
  const d2b = (await getExerciseMeta(page, logDay))[0];
  await fillExerciseSets(page, d2b.id, 1, 55, 8, 1);
  await page.fill("#notes", "collision-test-A");
  await Promise.all([page.click(".btn--save"), page.click(".btn--save")]);
  await page.waitForTimeout(300);
  state = await getState(page);
  const collisionSessions = [
    ...new Set(
      state.log.filter((x) => x.date === collisionDate && x.notes === "collision-test-A").map((x) => x.session)
    ),
  ];
  assert(
    collisionSessions.length === 1,
    "Double-click save commits once (no duplicate session)",
    `Expected 1 session from double-click, got ${collisionSessions.length}`,
    "Log tab → fill workout → double-click Save workout rapidly"
  );

  // Invalid step value blocks save silently (HTML5 validation)
  await nav(page, "log");
  await selectDay(page, "Day 3");
  await page.fill("#date", "2018-04-01");
  const d3 = (await getExerciseMeta(page, "Day 3"))[0];
  await fillExerciseSets(page, d3.id, 1, 61.25, 8, 1);
  const logLenBeforeInvalid = (await getState(page)).log.length;
  await page.click(".btn--save");
  await page.waitForTimeout(200);
  const logLenAfterInvalid = (await getState(page)).log.length;
  const formValid = await page.evaluate(() => document.querySelector("#logForm").checkValidity());
  if (!formValid && logLenAfterInvalid === logLenBeforeInvalid) {
    fail(
      "Silent save failure when load is not a 0.5 increment",
      "Entering 61.25 kg blocks HTML5 form validation with no toast or inline error. Input step=0.5 rejects .25 endings.",
      "Log tab → enter 61.25 kg → Save workout — nothing happens, no error shown"
    );
  } else {
    pass("Load validation allows save or shows user feedback");
  }

  // History sorted / sessions list
  await nav(page, "history");
  state = await getState(page);
  const sessionCards = await page.locator(".session").count();
  assert(
    sessionCards > 0,
    "History sessions list populated",
    `Count: ${sessionCards}`,
    "History tab after logging"
  );

  const historyTableRows = await page.locator("#historyTable tbody tr").count();
  assert(
    historyTableRows === state.log.length,
    "History table row count matches log",
    `Table ${historyTableRows} vs log ${state.log.length}`,
    "History tab → Every set table"
  );

  // Volume audit renders
  await nav(page, "program");
  const volRows = await page.locator(".vrow").count();
  assert(
    volRows > 0,
    "Volume audit renders muscle rows",
    `vrow count: ${volRows}`,
    "Program tab → Weekly volume audit"
  );

  // Delete log (reset) — test then stop (wipes data for clean exit)
  await nav(page, "settings");
  const logLenBeforeReset = (await getState(page)).log.length;
  await page.click("#reset");
  await page.waitForTimeout(150);
  state = await getState(page);
  assert(
    state.log.length === 0 && logLenBeforeReset > 0,
    "Delete log clears all sessions",
    `Log length ${state.log.length}, was ${logLenBeforeReset}`,
    "Settings → Delete log → confirm"
  );

  // Program should survive reset
  assert(
    state.program.length > 0,
    "Delete log preserves program",
    "Program was wiped with log",
    "Settings → Delete log → Program tab should still have exercises"
  );

  // Invalid import
  const badJsonPath = join(tmpDir, "bad.json");
  writeFileSync(badJsonPath, '{"not": "a backup"}');
  await page.setInputFiles("#importJson", badJsonPath);
  await page.waitForTimeout(200);
  const badToast = await page.locator("#toast").textContent();
  assert(
    badToast.includes("valid") || badToast.includes("backup"),
    "Invalid import shows error toast",
    `Toast: "${badToast}"`,
    "Settings → Import non-RepForge JSON file"
  );

  // ── Phase 12: All-tier upgrades ──────────────────────────────────
  console.log("\nPhase 12: Progression + UX + hypertrophy upgrades");

  await clearState(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForApp(page);

  // Settings auto-save on change (no Save click)
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#settings details.advanced")?.setAttribute("open", ""));
  await page.fill("#hardRir", "3");
  await page.locator("#hardRir").blur();
  await page.waitForTimeout(120);
  assert(
    (await getState(page)).settings.hardRir === 3,
    "Settings auto-save on change",
    `hardRir=${(await getState(page)).settings.hardRir}`,
    "Settings → change Hard-set RIR ceiling → blur (no Save click)"
  );

  // Setup notes persist and show on the Log card
  await nav(page, "program");
  const note = "Seat 4, feet high";
  const noteInput = page.locator('.pex [data-field="notes"]').first();
  await noteInput.fill(note);
  await noteInput.blur();
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const info0 = await cardInfo(page, 0);
  assert(
    info0.setup.includes(note),
    "Setup notes show on Log card",
    `Setup text: "${info0.setup}"`,
    "Program → add setup notes → Log card shows them"
  );

  const day1 = await getExerciseMeta(page, "Day 1");
  const ex0 = day1[0].id;

  assert(
    (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-suggested"),
    "Untouched suggestion row is greyed",
    "Set row not marked is-suggested before edit",
    "Log → open exercise → set rows show as suggestions until touched"
  );

  await page.fill(`[data-k="${ex0}_1_load"]`, "100");
  await page.click(`.saveset[data-save="${ex0}_1"]`);
  await page.waitForTimeout(80);
  assert(
    (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-done"),
    "Save set marks the set done",
    "Row not is-done after Save set",
    "Log → enter weight → Save set → row shows done"
  );

  assert(
    (await page.getAttribute('#dayTabs button[data-day="Day 1"]', "aria-selected")) === "true",
    "Active day tab exposes aria-selected",
    "Active day tab missing aria-selected=true",
    "Log → select a day → its tab is aria-selected"
  );

  await saveWorkout(page);
  const stAfterFinish = await getState(page);
  const loggedEx0 = stAfterFinish.log.filter((r) => r.exerciseId === ex0);
  assert(
    loggedEx0.length === 1 && +loggedEx0[0].set === 1,
    "Finish logs only committed/edited sets, not pristine suggestions",
    `logged sets for ex0: ${loggedEx0.map((r) => r.set).join(",")}`,
    "Log → Save one set, leave others suggested → Finish logs only the saved set"
  );

  // Stepper-edited suggested load is touched and persists on Finish
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const stepKey = `${ex0}_2`;
  assert(
    (await page.getAttribute(`.setrow[data-set="${stepKey}"]`, "class")).includes("is-suggested"),
    "Second set starts as suggested before stepper",
    "Set row not is-suggested before stepper edit",
    "Log → untouched set row → is-suggested"
  );
  await page.click(`.stepbtn[data-step="${ex0}_2_load"][data-dir="1"]`);
  await page.waitForTimeout(60);
  assert(
    !(await page.getAttribute(`.setrow[data-set="${stepKey}"]`, "class")).includes("is-suggested"),
    "Stepper click un-greys the set row",
    "Row still is-suggested after stepper",
    "Log → tap kg + stepper → row leaves suggested state"
  );
  await saveWorkout(page);
  const stAfterStepper = await getState(page);
  const stepperLogged = stAfterStepper.log.filter((r) => r.exerciseId === ex0 && +r.set === 2);
  assert(
    stepperLogged.length === 1 && +stepperLogged[0].load > 0,
    "Stepper-edited set is saved on Finish",
    `set 2 rows: ${stepperLogged.map((r) => r.load).join(",")}`,
    "Log → stepper-edit one suggested set → Finish → set is logged"
  );

  const exX = day1[0].id, exY = day1[1].id;

  // Session 1 for X
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);

  // Prefill: reps/RIR default to last session
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue(`[data-k="${exX}_1_reps"]`)) === "6" &&
      (await page.inputValue(`[data-k="${exX}_1_rir"]`)) === "1",
    "Log prefills reps/RIR from last session",
    `reps=${await page.inputValue(`[data-k="${exX}_1_reps"]`)} rir=${await page.inputValue(`[data-k="${exX}_1_rir"]`)}`,
    "Log → save a lift → reopen → reps/RIR match last session"
  );

  // kg stepper adds the minimum jump (2.5)
  await page.click(`.stepbtn[data-step="${exX}_1_load"][data-dir="1"]`);
  assert(
    (await page.inputValue(`[data-k="${exX}_1_load"]`)) === "102.5",
    "kg stepper increments by minimum jump",
    `value=${await page.inputValue(`[data-k="${exX}_1_load"]`)}`,
    "Log → click + on kg → increases by 2.5"
  );

  // Copy last refills from previous session
  await page.click(`.copylast[data-copy="${exX}"]`);
  assert(
    (await page.inputValue(`[data-k="${exX}_1_load"]`)) === "100",
    "Copy last refills from previous session",
    `load=${await page.inputValue(`[data-k="${exX}_1_load"]`)}`,
    "Log → Copy → inputs match last session"
  );

  // Collapse toggle
  await page.click(`.ex__caret[data-collapse="${exX}"]`);
  await page.waitForTimeout(80);
  assert(
    (await cardInfo(page, 0)).collapsed,
    "Exercise collapses on caret click",
    "Card not collapsed after caret click",
    "Log → tap caret → card collapses"
  );
  await page.click(`.ex__caret[data-collapse="${exX}"]`);

  // Sessions 2 and 3 for X (same load, same reps → stall)
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);

  // Y: reps below min → back off with a lower target
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exY, day1[1].sets, 80, 2, 1);
  await saveWorkout(page);

  // Inspect recommendations
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const xInfo = await cardInfo(page, 0);
  assert(
    xInfo.status === "is-reduce" && /stall/i.test(xInfo.chip),
    "Stall detection flags deload after 3 flat sessions",
    `status=${xInfo.status} chip="${xInfo.chip}"`,
    "Log → 3 sessions same load, no rep gain → Stalled · deload"
  );
  const yInfo = await cardInfo(page, 1);
  const yTarget = +(yInfo.rec.match(/Target\s+([\d.]+)\s*kg/)?.[1] || 0);
  assert(
    yInfo.status === "is-reduce" && yTarget > 0 && yTarget < 80,
    "Back off returns a real lighter target",
    `status=${yInfo.status} target=${yTarget}`,
    "Log → sets below min reps → Back off with target < logged load"
  );

  // Fatigue banner (2 lifts backing off on this day)
  const fatigue = await page.evaluate(() => {
    const el = document.querySelector("#fatigue");
    return { hidden: el.classList.contains("hidden"), text: el.textContent };
  });
  assert(
    !fatigue.hidden && /fatigue/i.test(fatigue.text),
    "Fatigue-watch banner appears when lifts back off",
    `hidden=${fatigue.hidden} text="${fatigue.text}"`,
    "Log → multiple lifts reduce/stall → fatigue banner"
  );

  // Stats: completed hard sets + attention board
  await nav(page, "stats");
  await page.evaluate(() => {
    const d = document.querySelector("#statsDeep");
    if (d) d.open = true;
  });
  await page.waitForTimeout(150);
  assert(
    (await page.locator("#completedVolume .vrow").count()) > 0,
    "Completed hard sets render per muscle",
    "No completed-volume rows",
    "Stats → Completed hard sets shows logged volume"
  );
  assert(
    (await page.locator("#attention .attn--reduce .attn__chip").count()) > 0,
    "Attention board lists lifts to back off",
    "No reduce chips in attention board",
    "Stats → action board shows Back off / stalled group"
  );

  // Edit a logged session in History
  await nav(page, "history");
  await page.locator(".session__edit").first().click();
  await page.waitForTimeout(100);
  const editInput = page.locator('.session--edit [data-ek^="load|"]').first();
  await editInput.fill("123");
  await page.locator("[data-edsave]").first().click();
  await page.waitForTimeout(150);
  assert(
    (await getState(page)).log.some((r) => +r.load === 123),
    "Edit session writes changes back to the log",
    "No log row with edited load 123",
    "History → Edit → change a load → Save changes"
  );

  // Rest timer starts and is visible
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.click("#workout .ex__rest");
  await page.waitForTimeout(120);
  assert(
    !(await page.locator("#restBar").getAttribute("class")).includes("hidden"),
    "Rest timer shows on demand",
    "restBar still hidden after tapping ⏱",
    "Log → tap ⏱ on an exercise → rest timer appears"
  );
  await page.click("#restBar");

  // Glossary explains RIR on tap
  await page.click("#workout .term[data-term='RIR']");
  await page.waitForTimeout(80);
  assert(
    !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
      /reserve/i.test(await page.locator("#glossary .glossary__body").textContent()),
    "Glossary explains RIR on tap",
    "Glossary popover did not open with RIR definition",
    "Log → tap 'RIR' → definition popover opens"
  );
  await page.click("#glossary .glossary__close");

  // Skipped exercise is not saved
  const metaSkip = await getExerciseMeta(page, "Day 1");
  const skipId = metaSkip[0].id;
  await page.fill(`[data-k="${skipId}_1_load"]`, "50");
  await page.click(`.ex__skip[data-skip="${skipId}"]`);
  await page.waitForTimeout(80);
  const skipSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  const stSkip = await getState(page);
  const newSessions = [...new Set(stSkip.log.map((r) => r.session))].filter((s) => !skipSessionsBefore.has(s));
  const skipSavedInNewSession = newSessions.some((sid) =>
    stSkip.log.some((r) => r.session === sid && r.exerciseId === skipId)
  );
  assert(
    !skipSavedInNewSession,
    "Skipped exercise is not saved",
    "A skipped exercise's set was persisted in a new session",
    "Log → fill a set → Skip it → Save → that exercise has no new rows"
  );

  // Unit toggle: draft loads convert on unit change; persisted log stays kg
  await clearState(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const unitMeta = await getExerciseMeta(page, "Day 1");
  const unitEx = unitMeta[0].id;
  await page.fill(`[data-k="${unitEx}_1_load"]`, "100");
  await page.fill(`[data-k="${unitEx}_1_reps"]`, "6");
  await page.fill(`[data-k="${unitEx}_1_rir"]`, "1");
  await page.waitForTimeout(80);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const lbDraft = +(await page.inputValue(`[data-k="${unitEx}_1_load"]`));
  assert(
    Math.abs(lbDraft - 220.46226218) < 0.15,
    "Draft load converts kg to lb on unit switch",
    `draft load=${lbDraft}`,
    "Log → enter 100 kg → Settings unit=lb → draft shows ~220.46 lb"
  );
  await saveWorkout(page);
  const kgFromLbDraft = (await getState(page)).log.find((r) => r.exerciseId === unitEx && +r.set === 1);
  assert(
    kgFromLbDraft && Math.abs(kgFromLbDraft.load - 100) < 0.1,
    "Draft saved after kg→lb switch stores canonical kg",
    `stored load=${kgFromLbDraft?.load}`,
    "Log → 100 kg draft → switch lb → save → log row is ~100 kg"
  );

  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${unitEx}_1_load"]`, "100");
  await page.waitForTimeout(60);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue(`[data-k="${unitEx}_1_load"]`)) === "100",
    "Draft load round-trips kg→lb→kg",
    `draft load=${await page.inputValue(`[data-k="${unitEx}_1_load"]`)}`,
    "Log → 100 kg draft → switch lb → switch kg → draft shows 100 again"
  );

  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${unitEx}_1_load"]`, "225");
  await page.fill(`[data-k="${unitEx}_1_reps"]`, "5");
  await page.fill(`[data-k="${unitEx}_1_rir"]`, "2");
  await saveWorkout(page);
  const lbEntry = (await getState(page)).log.filter((r) => r.exerciseId === unitEx).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  assert(
    lbEntry && Math.abs(lbEntry.load - 102.058283) < 0.1,
    "Direct lb entry stores canonical kg",
    `stored load=${lbEntry?.load}`,
    "Log → unit=lb → enter 225 lb → save → log row is ~102.06 kg"
  );

  assert(
    (await getState(page)).log.every((r) => r.load < 1000),
    "Stored loads remain kg after unit switch",
    "A stored load looks converted to lb",
    "Settings → unit=lb → repforge_v1 loads still kg"
  );
  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);

  // Console errors
  assert(
    consoleErrors.length === 0,
    "No console errors during simulation",
    consoleErrors.slice(0, 5).join("; ") || "(none listed)",
    "Run simulation with DevTools console open"
  );

  rmSync(tmpDir, { recursive: true, force: true });
  await browser.close();

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log(`Sessions simulated: ${sessionCount}`);
  console.log("=".repeat(60));

  if (results.bugs.length) {
    console.log("\nBUG REPORT\n");
    results.bugs.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name}`);
      console.log(`   Detail: ${b.detail}`);
      console.log(`   Repro:  ${b.repro}`);
      console.log("");
    });
  } else {
    console.log("\nNo bugs found — all checks passed.\n");
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(2);
});
