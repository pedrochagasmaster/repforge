#!/usr/bin/env node
/** Plan 057-P7: Program roles, readiness routing, and editor dock clearance. */
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

function rowsFor(ids, { ready = true } = {}) {
  const date = ymd(-2);
  return ids.flatMap((id) => Array.from({ length: 2 }, (_, index) => ({
    session: `program-actions-${id}`,
    date,
    day: id === "seed-ex-1" ? "Day 1" : "Day 2",
    exerciseId: id,
    name: id === "seed-ex-1" ? "Hack squat" : "Leg press",
    load: 100,
    reps: ready ? 8 : 6,
    rir: ready ? 1 : 2,
    set: index + 1,
    work: true,
    created: `${date}T12:0${index}:00.000Z`,
  })));
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

async function readyOracle(page) {
  return page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const ready = (state.program || []).filter((exercise) => {
      const status = window.__repforgeRecommendation?.(exercise)?.status;
      return status === "add" || status === "add2";
    });
    return {
      ids: ready.map((exercise) => exercise.id),
      statuses: ready.map((exercise) => window.__repforgeRecommendation(exercise).status),
      expected: window.RepForgeI18n.t("program.ready_to_add", { n: ready.length }),
    };
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
  await install(page, rowsFor(["seed-ex-1"], { ready: false }));
  await openProgram(page);
  const overview = await page.evaluate(() => ({
    disclosures: [...document.querySelectorAll("#programOverview .prog-day__head")].map((button) => ({
      expanded: button.getAttribute("aria-expanded"),
      role: button.dataset.actionRole || "",
    })),
    readyLink: document.querySelector("#programReadyLink")?.textContent.trim() || null,
    readyStats: [...document.querySelectorAll("#programOverview .statrow__cell")]
      .map((cell) => cell.textContent.trim())
      .filter((text) => /ready/i.test(text)),
    reviewRole: document.querySelector("#reviewBlockLink")?.dataset.actionRole || "",
  }));
  check(overview.disclosures.length > 0 && overview.disclosures.every((item) =>
    (item.expanded === "true" || item.expanded === "false") && item.role === "expansion"),
    "overview day controls expose expansion state", overview.disclosures);
  check(!overview.readyLink && overview.readyStats.length === 0,
    "zero readiness renders no ready action or 0-ready chip", overview);
  check(overview.reviewRole === "navigation", "Review block is marked as navigation", overview.reviewRole);

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

  console.log("\nProgram readiness");
  await install(page, rowsFor(["seed-ex-1", "seed-ex-2"]));
  await openProgram(page);
  const oracle = await readyOracle(page);
  check(oracle.ids.length > 0, "the fixture produces at least one recommendation-owned ready exercise", oracle);
  const readyLink = page.locator("#programReadyLink");
  if (await readyLink.count()) {
    const readiness = await page.evaluate((expected) => ({
      text: document.querySelector("#programReadyLink")?.textContent.trim() || null,
      expected,
    }), oracle.expected);
    check(readiness.text === oracle.expected, "readiness action names the exact recommendation-owned count", readiness);
    await readyLink.click();
    const readyView = await page.evaluate(() => ({
      ids: [...document.querySelectorAll("#programOverview [data-ready-ex]")].map((node) => node.dataset.readyEx),
      back: document.querySelector("#programReadyBack")?.textContent.trim() || "",
    }));
    check(JSON.stringify(readyView.ids) === JSON.stringify(oracle.ids), "ready view lists every ready exercise in program order", { readyView, oracle });
    check(readyView.back.length > 0, "ready view keeps a Back to program action", readyView.back);
    const firstReady = oracle.ids[0];
    await page.click(`[data-ready-ex="${firstReady}"]`);
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.click("#exBack");
    await page.waitForSelector("#program.view.active #programReadyBack", { timeout: 5000 });
    check(await page.locator(`#programOverview [data-ready-ex="${firstReady}"]`).count() === 1,
      "exercise detail returns to the ready view", firstReady);
    await page.click("#programReadyBack");
    await page.click("#reviewBlockLink");
    await page.waitForSelector('#stats.view.active #statsSeg button[data-seg="review"].active', { timeout: 5000 });
    check(await page.locator("#stats.view.active").count() === 1, "Review block routes through Progress Review", await page.locator("#stats.view.active").count());
  } else {
    check(false, "readiness action is rendered for recommendation-owned ready exercises", { oracle });
  }
} finally {
  await context.close();
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  assert.fail(failures.join("; "));
}
