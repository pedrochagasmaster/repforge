#!/usr/bin/env node
/**
 * Install Plan 050's released shell, write a real flat workout draft through
 * that app, then activate the current worker and prove the cached DraftV2 app
 * migrates once and resumes a non-first Focus card while fully offline.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_SHA = "3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4";
const OLD_PATHS = new Set(["index.html", "styles.css", "i18n.js", "app.js", "sw.js"]);
const oldFiles = new Map([...OLD_PATHS].map((path) => [
  `/${path}`,
  execFileSync("git", ["show", `${OLD_SHA}:${path}`]),
]));
const oldWorker = oldFiles.get("/sw.js").toString("utf8");
const currentWorker = readFileSync(join(ROOT, "sw.js"), "utf8");
const cacheName = (worker) => worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
const oldCache = cacheName(oldWorker);
const currentCache = cacheName(currentWorker);
assert(oldCache && currentCache && oldCache !== currentCache);

const STATE = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const CHECKPOINT = `${DRAFT}:v2-checkpoint`;
let mode = "old";
const statSafe = (path) => { try { return statSync(path); } catch { return null; } };
const type = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webp": "image/webp", ".woff2": "font/woff2",
}[extension] || "application/octet-stream");

const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  if (mode === "old" && oldFiles.has(normalizedPath)) {
    response.writeHead(200, { "content-type": type(extname(normalizedPath)), "cache-control": "no-store" });
    response.end(oldFiles.get(normalizedPath));
    return;
  }
  const file = normalize(join(ROOT, normalizedPath.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404);response.end("Not found");return;
  }
  response.writeHead(200, { "content-type": type(extname(file)), "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});

async function seedState(page) {
  const current = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) || "{}", STATE));
  const state = {
    ...current,
    program: seedProgram(), programMeta: seedProgramMeta(), log: [], programHistory: [],
    settings: { ...current.settings, lang: "en", unit: "kg", rirMode: "numeric", restSec: 0 },
  };
  await page.evaluate(async ({ key, value, draft, checkpoint }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.removeItem(draft);localStorage.removeItem(checkpoint);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(value, key);
      transaction.oncomplete = resolve;transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { key: STATE, value: state, draft: DRAFT, checkpoint: CHECKPOINT });
}

async function boot(page, base) {
  await waitForAppBoot(page, { base });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    if (!document.querySelector("#tour")?.classList.contains("hidden")) window.closeTour?.();
    window.stopRest?.();
  });
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
const page = await context.newPage();
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });await boot(page, base);await seedState(page);
  await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready;await registration.update(); });
  await page.waitForFunction((cache) => caches.has(cache), oldCache);
  await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, "Plan 050 worker controls its app");

  const secondId = seedProgram().filter((exercise) => exercise.day === "Day 1")[1].id;
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: "Day 1" }));
  await page.locator("#woNext").click();
  await page.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${secondId}"]`);
  for (const [field, value] of [["load", "72.5"], ["reps", "9"], ["rir", "1"]]) {
    await page.locator(`#workout .exercise.is-current [data-k="${secondId}_1_${field}"]`).fill(value);
  }
  await page.waitForFunction(({ draft, key }) => {
    const value = JSON.parse(localStorage.getItem(draft) || "{}");
    return value.schemaVersion == null && value.__day === "Day 1" && value[key] === "72.5";
  }, { draft: DRAFT, key: `${secondId}_1_load` });
  const legacyRaw = await page.evaluate((draft) => localStorage.getItem(draft), DRAFT);

  mode = "current";
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready;await registration.update(); });
  await page.waitForFunction(async ({ oldCache, currentCache }) => {
    const names = await caches.keys();return names.includes(currentCache) && !names.includes(oldCache);
  }, { oldCache, currentCache }, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);
  const migrated = await page.evaluate(({ draft, checkpoint, secondId }) => {
    const raw = localStorage.getItem(draft), value = JSON.parse(raw);
    const committed = JSON.parse(localStorage.getItem(checkpoint) || "null");
    const exercise = value.exercises[secondId], set = exercise.sets[exercise.setOrder[0]];
    return { raw, schemaVersion: value.schemaVersion, load: set.edited.load, reps: set.edited.reps,
      rir: set.edited.rir, checkpoint: committed };
  }, { draft: DRAFT, checkpoint: CHECKPOINT, secondId });
  assert.equal(migrated.schemaVersion, 2, "the current app migrates the old flat draft");
  assert.deepEqual([migrated.load, migrated.reps, migrated.rir], ["72.5", "9", "1"]);
  assert.equal(migrated.checkpoint?.kind, "committed");
  assert.equal(migrated.checkpoint?.raw, migrated.raw);
  assert.notEqual(migrated.raw, legacyRaw);

  await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);
  assert.equal(await page.evaluate((draft) => localStorage.getItem(draft), DRAFT), migrated.raw,
    "a second boot reads the same migration instead of converting twice");
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: "Day 1" }));
  await page.locator("#woNext").click();
  await page.waitForFunction((id) => window.__repforgeWorkoutDraft.current()?.session.selectedExerciseId === id, secondId);
  const selectedRaw = await page.evaluate((draft) => localStorage.getItem(draft), DRAFT);

  await context.setOffline(true);
  const response = await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);
  assert.equal(response?.fromServiceWorker(), true, "the current cached shell boots offline");
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true }));
  await page.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${secondId}"]`);
  assert.equal(await page.evaluate((draft) => localStorage.getItem(draft), DRAFT), selectedRaw,
    "offline reload preserves the complete selected non-first Focus revision");
  assert.equal(await page.locator(`#workout .exercise.is-current [data-k="${secondId}_1_load"]`).inputValue(), "72.5");
  await page.locator(`#workout .exercise.is-current [data-k="${secondId}_1_load"]`).fill("73.5");
  await page.locator(`#workout .exercise.is-current [data-k="${secondId}_1_reps"]`).fill("10");
  await page.waitForFunction((exerciseId) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft?.exercises?.[exerciseId], set = exercise?.sets?.[exercise?.setOrder?.[0]];
    return set?.edited?.load === "73.5" && set?.edited?.reps === "10";
  }, secondId);
  await page.locator("#workout .exercise.is-current .saveset").click();
  await page.waitForFunction((exerciseId) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft?.exercises?.[exerciseId];
    return exercise && exercise.sets[exercise.setOrder[0]].completion !== "pending";
  }, secondId);
  const offlineSave = await page.evaluate(() => window.__repforgeSaveWorkout());
  const offlineResult = await page.evaluate(({ stateKey, draftKey, checkpointKey, exerciseId }) => {
    const state = JSON.parse(localStorage.getItem(stateKey) || "{}");
    const checkpoint = JSON.parse(localStorage.getItem(checkpointKey) || "null");
    const row = state.log?.find((candidate) => candidate.exerciseId === exerciseId);
    return { row, draftRaw: localStorage.getItem(draftKey), checkpoint };
  }, { stateKey: STATE, draftKey: DRAFT, checkpointKey: CHECKPOINT, exerciseId: secondId });
  assert(offlineSave.localOk || offlineSave.idbOk, "the fully offline History transaction commits");
  assert.deepEqual(
    [offlineResult.row?.load, offlineResult.row?.reps, offlineResult.row?.rir],
    [73.5, 10, 1],
    "the offline save compiles the migrated visible values into History"
  );
  assert.equal(offlineResult.draftRaw, null, "the committed offline save removes the active draft");
  assert.equal(offlineResult.checkpoint?.kind, "tombstone", "the offline save protects removal from an old writer");

  console.log(`workout draft SW upgrade: ${oldCache} flat V1 -> ${currentCache} DraftV2; one migration, offline non-first Focus resume, completion, and save pass`);
} finally {
  await context.setOffline(false).catch(() => {});
  await context.close();await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
