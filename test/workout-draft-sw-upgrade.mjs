#!/usr/bin/env node
/**
 * Install Plan 050's released shell, write a real flat workout draft through
 * that app, then activate the current worker and prove the cached DraftV2 app
 * migrates once and resumes a non-first Focus card while fully offline.
 *
 * The released app is served from its own commit in full (every module it
 * loads), as its installed cache would hold it, and it owns the legacy flat
 * program it was released with (that commit's seed fixture, no canonical
 * ProgramDefinition). Plan 067 requires no migration of such a program; the
 * current app must still never rewrite or erase it on boot.
 */
import assert from "node:assert/strict";
import { finishEarly } from "./fixtures/focus-workout.mjs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot, waitForWorkerTakeover } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_SHA = "3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4";
const oldFiles = new Map();
function oldFile(pathname) {
  if (!oldFiles.has(pathname)) {
    let bytes = null;
    try { bytes = execFileSync("git", ["show", `${OLD_SHA}:${pathname.slice(1)}`], { cwd: ROOT, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); }
    catch {}
    oldFiles.set(pathname, bytes);
  }
  return oldFiles.get(pathname);
}
const legacyFixture = await import(`data:text/javascript;base64,${oldFile("/test/fixtures/seed-program.mjs").toString("base64")}`);
const oldWorker = oldFile("/sw.js").toString("utf8");
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
  if (mode === "old") {
    const bytes = oldFile(normalizedPath);
    if (!bytes) { response.writeHead(404);response.end("Not found");return; }
    response.writeHead(200, { "content-type": type(extname(normalizedPath)), "cache-control": "no-store" });
    response.end(bytes);
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
    program: legacyFixture.seedProgram(), programMeta: legacyFixture.seedProgramMeta(), log: [], programHistory: [],
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

// Every await below runs inside a named, bounded stage (#348). A stage that
// never settles fails with its name and the page's worker state instead of
// holding the suite until the runner's 600 s limit.
const started = Date.now();
let page = null;
const within = (promise, ms, fallback) => Promise.race([
  Promise.resolve(promise).catch((error) => `${fallback}: ${error.message}`),
  new Promise((resolve) => setTimeout(() => resolve(`${fallback} within ${ms}ms`), ms)),
]);
async function workerState() {
  if (!page) return "no page";
  const snapshot = page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = (candidate) => candidate ? `${candidate.state}:${new URL(candidate.scriptURL).pathname}` : null;
    return {
      url: location.href, readyState: document.readyState, booted: window.__repforgeBooted === true,
      controller: worker(navigator.serviceWorker.controller),
      registration: registration ? {
        installing: worker(registration.installing), waiting: worker(registration.waiting), active: worker(registration.active),
      } : null,
      caches: await caches.keys(),
      locks: await navigator.locks?.query?.().catch(() => null) ?? null,
    };
  });
  const workers = page.context().serviceWorkers();
  return JSON.stringify({
    page: await within(snapshot, 5000, "page state unavailable"),
    pageUrl: page.url(),
    workers: workers.map((worker) => worker.url().replace(base, "/")),
    targets: await within(page.context().browser().newBrowserCDPSession()
      .then((session) => session.send("Target.getTargets"))
      .then(({ targetInfos }) => targetInfos.map((info) => `${info.type}:${info.url.replace(base, "/")}${info.attached ? "" : " (detached)"}`)),
    5000, "targets unavailable"),
  });
}
async function stage(name, work, timeoutMs = 30000) {
  const at = () => `+${Date.now() - started}ms`;
  console.log(`[sw-upgrade ${at()}] ${name}`);
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`stage "${name}" did not settle within ${timeoutMs}ms`), { stalled: true })), timeoutMs);
  });
  try {
    return await Promise.race([work(), deadline]);
  } catch (error) {
    if (error.stalled) {
      error.message += `; worker state ${await workerState()}`;
      // Report the stall now: a wedged browser can also hold teardown.
      console.error(`[sw-upgrade ${at()}] ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
page = await context.newPage();
const reload = (name) => stage(name, async () => {
  const response = await page.reload({ waitUntil: "domcontentloaded" });await boot(page, base);return response;
}, 45000);
const updateWorker = (name) => stage(name, () => page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;await registration.update();
}), 20000);
const workerSettled = (name, { cache, replaced = null }) =>
  stage(name, () => waitForWorkerTakeover(page, { cache, replaced, timeout: 30000 }), 30000);
let failure = null;
try {
  await stage("open the released app", async () => {
    await page.goto(base, { waitUntil: "domcontentloaded" });await boot(page, base);
  }, 45000);
  await stage("seed the released program", () => seedState(page));
  await reload("reload the seeded released app");
  await updateWorker("update the released worker");
  await workerSettled("released worker controls its precached release", { cache: oldCache });
  await reload("reload under the released worker");
  assert.equal(await stage("read the controller", () => page.evaluate(() => !!navigator.serviceWorker.controller)), true,
    "Plan 050 worker controls its app");

  const secondId = legacyFixture.seedProgram().filter((exercise) => exercise.day === "Day 1")[1].id;
  const { legacyRaw, legacyState } = await stage("write a flat draft through the released app", async () => {
    // The retained Plan 050 worker still needs its historical route flag before
    // the current worker migrates the draft. Current-code calls below omit it.
    await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1", focus: true }));
    // This page still runs the retained Plan 050 build, whose header carries the Next chevron.
    await page.locator("#woNext").click();
    await page.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${secondId}"]`);
    for (const [field, value] of [["load", "72.5"], ["reps", "9"], ["rir", "1"]]) {
      await page.locator(`#workout .exercise.is-current [data-k="${secondId}_1_${field}"]`).fill(value);
    }
    await page.waitForFunction(({ draft, key }) => {
      const value = JSON.parse(localStorage.getItem(draft) || "{}");
      return value.schemaVersion == null && value.__day === "Day 1" && value[key] === "72.5";
    }, { draft: DRAFT, key: `${secondId}_1_load` });
    return {
      legacyRaw: await page.evaluate((draft) => localStorage.getItem(draft), DRAFT),
      legacyState: await page.evaluate((key) => localStorage.getItem(key), STATE),
    };
  }, 60000);
  assert.equal(JSON.parse(legacyState).programMeta.programDefinition, undefined,
    "the released app owns a legacy flat program without a canonical definition");

  mode = "current";
  await updateWorker("update to the current worker");
  await workerSettled("current worker controls the page and removed the released cache", { cache: currentCache, replaced: oldCache });
  await reload("reload under the current worker");
  const migrated = await stage("read the migrated draft", () => page.evaluate(({ draft, checkpoint, secondId }) => {
    const raw = localStorage.getItem(draft), value = JSON.parse(raw);
    const committed = JSON.parse(localStorage.getItem(checkpoint) || "null");
    const exercise = value.exercises[secondId], set = exercise.sets[exercise.setOrder[0]];
    return { raw, schemaVersion: value.schemaVersion, load: set.edited.load, reps: set.edited.reps,
      rir: set.edited.rir, checkpoint: committed };
  }, { draft: DRAFT, checkpoint: CHECKPOINT, secondId }));
  assert.equal(migrated.schemaVersion, 2, "the current app migrates the old flat draft");
  assert.deepEqual([migrated.load, migrated.reps, migrated.rir], ["72.5", "9", "1"]);
  assert.equal(migrated.checkpoint?.kind, "committed");
  assert.equal(migrated.checkpoint?.raw, migrated.raw);
  assert.notEqual(migrated.raw, legacyRaw);
  assert.equal(await stage("read the durable program", () => page.evaluate((key) => localStorage.getItem(key), STATE)), legacyState,
    "booting the current app neither rewrites nor erases the legacy durable program bytes");

  await reload("reload the migrated app");
  assert.equal(await stage("read the draft after a second boot", () => page.evaluate((draft) => localStorage.getItem(draft), DRAFT)), migrated.raw,
    "a second boot reads the same migration instead of converting twice");
  const selectedRaw = await stage("select the second exercise", async () => {
    await page.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
    await page.waitForFunction((id) => window.__repforgeWorkoutDraft.current()?.session.selectedExerciseId === id, secondId);
    return page.evaluate((draft) => localStorage.getItem(draft), DRAFT);
  }, 60000);

  await stage("go offline", () => context.setOffline(true));
  const response = await reload("reload offline");
  assert.equal(response?.fromServiceWorker(), true, "the current cached shell boots offline");
  await stage("resume the selected exercise offline", async () => {
    await page.evaluate(() => window.__repforgeEnterWorkout({}));
    await page.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${secondId}"]`);
  });
  assert.equal(await stage("read the offline draft", () => page.evaluate((draft) => localStorage.getItem(draft), DRAFT)), selectedRaw,
    "offline reload preserves the complete selected non-first Focus revision");
  await stage("edit and save the set offline", async () => {
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
  }, 60000);
  const offlineSave = await stage("finish the workout offline", () => finishEarly(page), 60000);
  const offlineResult = await stage("read the offline save", () => page.evaluate(({ stateKey, draftKey, checkpointKey, exerciseId }) => {
    const state = JSON.parse(localStorage.getItem(stateKey) || "{}");
    const checkpoint = JSON.parse(localStorage.getItem(checkpointKey) || "null");
    const row = state.log?.find((candidate) => candidate.exerciseId === exerciseId);
    return { row, draftRaw: localStorage.getItem(draftKey), checkpoint };
  }, { stateKey: STATE, draftKey: DRAFT, checkpointKey: CHECKPOINT, exerciseId: secondId }));
  assert(offlineSave.localOk || offlineSave.idbOk, "the fully offline History transaction commits");
  assert.deepEqual(
    [offlineResult.row?.load, offlineResult.row?.reps, offlineResult.row?.rir],
    [73.5, 10, 1],
    "the offline save compiles the migrated visible values into History"
  );
  assert.equal(offlineResult.draftRaw, null, "the committed offline save removes the active draft");
  assert.equal(offlineResult.checkpoint?.kind, "tombstone", "the offline save protects removal from an old writer");

  console.log(`workout draft SW upgrade: ${oldCache} flat V1 -> ${currentCache} DraftV2; one migration, offline non-first Focus resume, completion, and save pass`);
} catch (error) {
  failure = error;
}
try {
  await stage("close the browser", async () => {
    await context.setOffline(false).catch(() => {});
    await context.close();await browser.close();
  }, 15000);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
} catch (error) {
  failure ||= error;
}
if (failure) {
  console.error(failure);
  // A browser that would not close still holds the process open.
  process.exit(1);
}
