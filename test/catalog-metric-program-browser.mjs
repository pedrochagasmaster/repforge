#!/usr/bin/env node
/**
 * Plan 067's first complete production slice: Build from the raw UUID catalog,
 * record source-ordered metric values, reload, inspect History, and round-trip
 * an ordinary backup through the production import controls.
 *
 * Run with `node tools/run-tests.mjs entry --suite-id test-catalog-metric-program-browser-mjs`.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";
const DB_NAME = "repforge";
const STORE_NAME = "kv";
const CATALOG_TEXT = readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url), "utf8");
const CATALOG = JSON.parse(CATALOG_TEXT);
const CATALOG_SHAPE_FAILURE = JSON.stringify({
  exercises: [], uuidIndex: {}, generatedAt: "2026-10-06T00:00:00.000Z",
});
const PICKED = [
  { id: "2aa5c6f170d880c08fcbf27e03a0e2dc", name: "45° glute-biased leg press", values: { Weight: 60, Reps: 8 } },
  { id: "1a35c6f170d88025a7a1f34e94c394c5", name: "Ankle-banded lateral walk", values: { Weight: 0, "Distance short per side": 12 } },
  { id: "2a95c6f170d8805e8b27cb88e703eac7", name: "Band-assisted chin-up", values: { Reps: 8, "Assistance weight": 25 } },
  { id: "2a15c6f170d88066b38fd65f8757716f", name: "45° cable rear delt fly", values: { "Reps per side": 10, "Weight per side": 4.5 } },
  { id: "3015c6f170d88066b005e27ff4833597", name: "Battle rope alternating wave", values: { Duration: 40 } },
  { id: "2d35c6f170d880a89c8dd0ed7878b2e9", name: "Backward sled drag with belt", values: { Weight: 20, "Distance short": 24 } },
  { id: "29f5c6f170d880fdba13cc79ea455578", name: "Dumbbell lunge hold", values: { "Duration per side": 30, "Weight per side persistent": 4.5 } },
  { id: "2ed5c6f170d88043a626e0dac247c52c", name: "Air biking", values: { Duration: 600, "Distance long": 5000 } },
];
const sourceById = new Map(CATALOG.exercises.map((entry) => [entry.id, entry]));
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
    if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function same(actual, expected) {
  return JSON.stringify(stable(actual)) === JSON.stringify(stable(expected));
}

async function readIdb(page) {
  return page.evaluate(({ dbName, storeName, key }) => new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(null); return; }
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => { const value = request.result ?? null; db.close(); resolve(value); };
      request.onerror = () => { const error = request.error; db.close(); reject(error); };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key: STATE_KEY });
}

async function replicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
  return { localRaw, local: JSON.parse(localRaw || "null"), idb: await readIdb(page) };
}

async function flush(page) {
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await flush(page);
}

function captureBrowserErrors(page) {
  const messages = [];
  const add = (type, value) => {
    if (messages.length >= 24) return;
    const text = String(value).slice(0, 700);
    messages.push({ type, text });
  };
  page.on("pageerror", (error) => add("pageerror", error?.stack || error));
  page.on("console", (message) => {
    if (message.type() === "error") add("console.error", message.text());
  });
  page.on("requestfailed", (request) => add("requestfailed", `${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`));
  return messages;
}

async function waitForBootWithDiagnostics(page, messages) {
  try {
    await waitForAppBoot(page, { base: BASE });
  } catch (error) {
    const observed = await page.evaluate(() => ({
      readyState: document.readyState,
      booted: window.__repforgeBooted === true,
      storageHook: typeof window.__repforgeStorage?.flush === "function",
      catalogError: window.__repforgeCatalogUnavailable || null,
      errors: [...document.querySelectorAll("[role=alert]")].map((element) => element.textContent.trim()).filter(Boolean),
    })).catch(() => null);
    const report = { message: error?.message || String(error), observed, browserErrors: messages.slice() };
    const directory = process.env.REPFORGE_ARTIFACT_DIR;
    if (directory) {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "catalog-metric-boot-errors.json"), `${JSON.stringify(report, null, 2)}\n`);
    }
    throw new Error(`Boot diagnostic: ${JSON.stringify(report)}`);
  }
}

async function captureJourneyFailure(page, stage, messages, error, name) {
  const observed = await page?.evaluate(() => ({
    url: location.href,
    readyState: document.readyState,
    booted: window.__repforgeBooted === true,
    bodyClass: document.body?.className || "",
    firstRunClass: document.querySelector("#firstRun")?.className || "",
    onboardingClass: document.querySelector("#onboarding")?.className || "",
    onboardingOpen: document.querySelector("#onboarding")?.open ?? null,
    entryHeading: document.querySelector("#entryHeading")?.textContent?.trim() || null,
    bodyText: document.querySelector("#onbBody")?.innerText?.slice(0, 1200) || "",
    dialogs: [...document.querySelectorAll("dialog")].map((dialog) => ({
      id: dialog.id, open: dialog.open, text: dialog.innerText?.slice(0, 500) || "",
    })),
    draftStorage: Object.keys(localStorage).filter((key) => key.startsWith("repforge_draft_v1"))
      .map((key) => ({ key, bytes: localStorage.getItem(key)?.length ?? 0, head: localStorage.getItem(key)?.slice(0, 600) || "" })),
    notices: [...document.querySelectorAll('[role="alert"], [role="status"]')]
      .map((element) => element.textContent.trim()).filter(Boolean).slice(0, 12),
    entryDiagnostics: (() => {
      try {
        const entry = window.__repforgeEntryState?.();
        const preview = entry?.result?.preview;
        const issues = window.RepForgeProgramEntry?.candidateActivationIssues?.(entry) || [];
        return {
          route: entry?.route || null,
          step: entry?.step || null,
          issues,
          persistence: window.__repforgeEntryPersistenceDiagnostic?.() || null,
          program: (preview?.program || []).map((row) => ({
            id: row.id, slotId: row.slotId, dayId: row.dayId, day: row.day, order: row.order,
            libraryId: row.libraryId, sets: row.sets, hasRepTarget: row.hasRepTarget,
            min: row.min, max: row.max,
          })),
          days: (preview?.programStructure?.days || []).map((day) => ({ dayId: day.dayId, label: day.label })),
        };
      } catch (error) {
        return { error: String(error) };
      }
    })(),
  })).catch(() => null);
  const report = { stage, message: error?.stack || String(error), observed, browserErrors: messages.slice() };
  const directory = process.env.REPFORGE_ARTIFACT_DIR;
  if (directory) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${name}-journey-error.json`), `${JSON.stringify(report, null, 2)}\n`);
    await page?.screenshot({ path: join(directory, `${name}-journey-error.png`), fullPage: false }).catch(() => {});
  }
  return report;
}

/** Issue #326: deterministic fault injection for the Build editor's durable-
 * write race. Every durable write serializes through navigator.locks.request
 * (durable-state.js's withStorageLock). Holding exactly one such acquisition
 * open lets this journey land its confirmation — and the re-render it
 * schedules — at a chosen instant instead of guessing a timeout, so the race
 * this proof guards reproduces on demand rather than by luck. CPU throttling
 * alone (the original hypothesis) was not enough to reproduce it reliably on
 * a fast, idle machine: the async storage round trip it widens is latency-
 * bound, not CPU-bound, so throttling the main thread inflates the
 * surrounding synchronous work far more than the actual race window. */
async function installStorageLockGate(page) {
  await page.addInitScript(() => {
    if (!navigator.locks || !navigator.locks.request) return;
    const original = navigator.locks.request.bind(navigator.locks);
    window.__repforgeGateLockCount = 0;
    window.__repforgeReleaseGatedLock = null;
    // Every durable commit — real or duplicate — makes exactly one of these
    // calls, so counting them is a cheap, test-owned way to assert "no
    // second commit happened" without depending on any editor-private name.
    window.__repforgeLockRequestCount = 0;
    navigator.locks.request = (name, optionsOrCallback, maybeCallback) => {
      window.__repforgeLockRequestCount += 1;
      const isCallbackArg = typeof optionsOrCallback === "function";
      const callback = isCallbackArg ? optionsOrCallback : maybeCallback;
      let gated = false;
      if (window.__repforgeGateLockCount > 0) { window.__repforgeGateLockCount -= 1; gated = true; }
      const wrapped = (...args) => {
        if (!gated) return callback(...args);
        return new Promise((resolve) => { window.__repforgeReleaseGatedLock = resolve; }).then(() => callback(...args));
      };
      return isCallbackArg ? original(name, wrapped) : original(name, optionsOrCallback, wrapped);
    };
  });
}
async function armStorageLockGate(page, count) {
  await page.evaluate((n) => { window.__repforgeGateLockCount = n; }, count);
}
async function releaseStorageLockGate(page) {
  await page.waitForFunction(() => typeof window.__repforgeReleaseGatedLock === "function", undefined, { timeout: 10000 });
  await page.evaluate(() => { window.__repforgeReleaseGatedLock(); window.__repforgeReleaseGatedLock = null; });
}

async function buildProgram(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="build"]');
  await page.fill("#entryProgramName", "Catalog metrics proof");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });

  let firstSlotCycle2SetIds = null;
  for (const [index, exercise] of PICKED.entries()) {
    const day = index < 3 ? "Day 1" : "Day 2";
    const dayCard = page.locator(`#onbProgramEditor [data-role="day"][data-day="${day}"]`);
    if (await dayCard.locator('[data-role="toggle-day"]').getAttribute("aria-expanded") === "false") {
      await dayCard.locator('[data-role="toggle-day"]').click();
    }
    const before = await page.locator('#onbProgramEditor [data-role="exercise"]').count();
    await page.locator(`#onbProgramEditor [data-role="add-exercise"][data-day="${day}"]`).click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.fill("#exPickSearch", exercise.name);
    const option = page.locator(`#exPickList [data-pick="${exercise.id}"]`);
    await option.waitFor({ timeout: 5000 });
    await option.click();
    await page.waitForFunction((count) =>
      document.querySelectorAll('#onbProgramEditor [data-role="exercise"]').length === count + 1, before, { timeout: 10000 });

    const row = page.locator('#onbProgramEditor [data-role="exercise"]').nth(before);
    if (await row.locator('[data-role="sets-control"]').count() === 0)
      await row.locator('[data-role="toggle-exercise"]').click();
    if (index === 0) {
      await page.waitForFunction((exerciseId) => {
        const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
        return definition?.days?.some(day => day.slots?.some(slot => slot.exerciseId === exerciseId));
      }, exercise.id, { timeout: 10000 });
      firstSlotCycle2SetIds = await page.evaluate((exerciseId) => {
        const slot = window.__repforgeEntryState().result.preview.programDefinition.days
          .flatMap(day => day.slots).find(candidate => candidate.exerciseId === exerciseId);
        return slot?.prescriptionsByCycle?.find(cycle => cycle.cycleIndex === 2)?.sets.map(set => set.id) || null;
      }, exercise.id);
    }
    const minus = row.locator('[data-role="adjust"][data-field="sets"][data-delta="-1"]');
    const cdp = index === 0 ? await page.context().newCDPSession(page) : null;
    for (let count = 2; count >= 1; count--) {
      // Issue #326: gate each decrement's durable write in turn so its
      // re-render can be released at the exact moment this journey wants
      // it, instead of guessing a timeout.
      if (index === 0) await armStorageLockGate(page, 1);
      await minus.click();
      await page.waitForFunction(({ index, count }) => {
        const rows = [...document.querySelectorAll('#onbProgramEditor [data-role="exercise"]')];
        return rows[index]?.querySelector('[data-role="sets-value"]')?.textContent.trim() === String(count);
      }, { index: before, count }, { timeout: 10000 });
      if (index === 0 && count === 2) {
        // A render can also land on a field that an *earlier* render has
        // already restored — e.g. a chain of delayed confirmations (several
        // structural edits queued up) landing back to back while the lifter
        // stays put without typing further in between. The restored value
        // sitting in that field was set directly (not through a keystroke),
        // so the browser's own dirty-tracking never saw it change — the
        // same reason a plain `.value=` assignment is the right way to
        // construct this deterministically, rather than fill(), which would
        // always re-dirty the field and trigger the teardown-commit path
        // instead of the one this check targets.
        const rirSelector = '[data-role="prescription-field"][data-cycle-index="1"][data-set-index="1"][data-field="rir"]';
        const rir = row.locator(rirSelector);
        await rir.focus();
        await page.evaluate((selector) => { document.querySelector(selector).value = "2"; }, rirSelector);
        const rirHandle = await rir.elementHandle();
        await releaseStorageLockGate(page);
        await page.waitForFunction((el) => !el.isConnected, rirHandle, { timeout: 10000 });
        await rir.press("Tab");
        const rirAfterTab = await page.evaluate((exerciseId) => {
          const slot = window.__repforgeEntryState().result.preview.programDefinition.days
            .flatMap(day => day.slots).find(candidate => candidate.exerciseId === exerciseId);
          return slot?.prescriptionsByCycle?.find(c => c.cycleIndex === 1)?.sets?.[0]?.rir ?? null;
        }, exercise.id);
        check(rirAfterTab === 2,
          "a value restored onto a field by an earlier render still commits when a later render lands on it, before any other field is touched", rirAfterTab);
      }
    }
    if (index === 0) {
      // Fast, unthrottled typing already reproduced the race locally once the
      // storage write is gated above; CPU throttling is layered on top for
      // fidelity with the slower/contended runners where this first surfaced.
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      const minSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="min"]';
      const min = row.locator(minSelector);
      // This is the reported race itself: fill() genuinely dirties the
      // original element, so when the render tears it down mid-edit, the
      // engine's own implicit "change" fires and commits 8 — but render()
      // had already built this cycle's HTML from the document as it stood
      // *before* that commit, so the freshly rebuilt min shows the stale 6.
      // Left alone, max's own commit then reads min's live (stale) DOM value
      // as its ranged peer and writes {min:6, max:12} right back. Capture
      // the element handle, release the held confirmation, and wait for
      // *that exact node* to be detached — proving the rebuild actually
      // happened while "8" was still uncommitted-on-screen — before moving
      // on, instead of racing the release against the Tab.
      const locksBeforeMin = await page.evaluate(() => window.__repforgeLockRequestCount);
      await min.fill("8");
      const minHandle = await min.elementHandle();
      await releaseStorageLockGate(page);
      await page.waitForFunction((el) => !el.isConnected, minHandle, { timeout: 10000 });
      await min.press("Tab");
      // The old, genuinely dirty element already committed "8" through its
      // own implicit "change" during teardown; the rebuilt field must not
      // also carry a pending commit of the same value, or this Tab would
      // make a second, duplicate durable write.
      const locksAfterMin = await page.evaluate(() => window.__repforgeLockRequestCount);
      check(locksAfterMin - locksBeforeMin === 1,
        "the teardown's own commit and this Tab together make exactly one durable write, not two", { locksBeforeMin, locksAfterMin });
      const max = row.locator('[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="max"]');
      await max.fill("12");
      await max.press("Tab");
      // Assert both together, immediately: this is exactly the moment a
      // stale-DOM min would get written back by max's own peer-read.
      const afterMinMax = await page.evaluate((exerciseId) => {
        const slot = window.__repforgeEntryState().result.preview.programDefinition.days
          .flatMap(day => day.slots).find(candidate => candidate.exerciseId === exerciseId);
        const targets = slot?.prescriptionsByCycle?.find(c => c.cycleIndex === 1)?.sets?.[0]?.targets?.reps;
        return { min: targets?.min ?? null, max: targets?.max ?? null };
      }, exercise.id);
      check(afterMinMax.min === 8 && afterMinMax.max === 12,
        "the rebuilt field shows the value the lifter typed, so a later sibling edit reading it as a peer does not write the stale default back", afterMinMax);
      const loadTarget = row.locator('[data-role="metric-target"][data-cycle-index="1"][data-semantic="loadKg"][data-set-index="1"][data-bound="value"]');
      await loadTarget.fill("65");
      await loadTarget.press("Tab");
      const firstRir = row.locator('[data-role="prescription-field"][data-cycle-index="1"][data-set-index="1"][data-field="rir"]');
      await firstRir.fill("2");
      await firstRir.press("Tab");
      const firstRest = row.locator('[data-role="prescription-field"][data-cycle-index="1"][data-set-index="1"][data-field="restSeconds"]');
      await firstRest.fill("90");
      await firstRest.press("Tab");
      const secondCycle = row.locator('[data-role="metric-cycle"][data-cycle-index="2"]');
      await secondCycle.locator(":scope > summary").click();
      const secondRir = secondCycle.locator('[data-role="prescription-field"][data-set-index="1"][data-field="rir"]');
      await secondRir.fill("3");
      await secondRir.press("Tab");
      const secondRest = secondCycle.locator('[data-role="prescription-field"][data-set-index="1"][data-field="restSeconds"]');
      await secondRest.fill("180");
      await secondRest.press("Tab");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await page.waitForFunction(({ exerciseId, cycle2Ids }) => {
        const slot = window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
          ?.flatMap(day => day.slots || []).find(candidate => candidate.exerciseId === exerciseId);
        const cycles = slot?.prescriptionsByCycle || [];
        return slot?.prescriptionsByCycle?.[0]?.sets?.length === 1 &&
          JSON.stringify(cycles.find(cycle => cycle.cycleIndex === 2)?.sets.map(set => set.id)) === JSON.stringify(cycle2Ids) &&
          cycles[0]?.sets?.[0]?.targets?.reps?.min === 8 && cycles[0]?.sets?.[0]?.targets?.reps?.max === 12 &&
          cycles[0]?.sets?.[0]?.targets?.loadKg === 65 && cycles[0]?.sets?.[0]?.rir === 2 &&
          cycles[0]?.sets?.[0]?.restSeconds === 90 && cycles[1]?.sets?.[0]?.rir === 3 && cycles[1]?.sets?.[0]?.restSeconds === 180;
      }, { exerciseId: exercise.id, cycle2Ids: firstSlotCycle2SetIds }, { timeout: 10000 });
      // Exercise-row actions are intentionally exposed from the day reorder
      // menu. Keep the row expanded so its details disclosure is reachable.
      await dayCard.locator('[data-role="day-menu"]').click();
      await dayCard.locator('[data-role="toggle-reorder"]').click();
      await row.locator('[data-role="exercise-menu"]').click();
      await row.locator('[data-role="more-details"][role="menuitem"]').click();
      const note = row.locator('[data-role="exercise-field"][data-field="notes"]');
      await note.fill("Rack set at the marked 45° stop");
      await note.blur();
    }
  }

  await page.click("#entryEditorActivate");
  await page.waitForFunction(() => {
    const state = window.__repforgeWorkoutDraft?.state?.();
    return state?.programMeta?.onboarded === true && state.programMeta.programDefinition?.days?.length === 7;
  }, undefined, { timeout: 20000 });
  await flush(page);
  return { firstSlotCycle2SetIds };
}

async function definitionSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__repforgeWorkoutDraft.state();
    return {
      name: state.programMeta.name,
      definition: state.programMeta.programDefinition,
      projection: state.program,
      customExercises: state.customExercises,
    };
  });
}

async function addMetricSet(page, movement, { actualRir = null } = {}) {
  const target = sourceById.get(movement.id);
  const sourceMetrics = target.exerciseMetrics.map((id) => ({ id, ...CATALOG.uuidIndex[id] }));
  const active = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const id = draft.session.selectedExerciseId;
    const exercise = draft.exercises[id];
    return { id, libraryId: exercise.libraryId, setId: exercise.setOrder[0], set: exercise.sets[exercise.setOrder[0]] };
  });
  check(active.libraryId === movement.id, `Focus reaches ${movement.name} from its selected catalog UUID`, active.libraryId);
  if (active.libraryId !== movement.id) {
    throw new Error(`Focus selection has not committed for ${movement.name}: expected ${movement.id}, got ${active.libraryId || "<none>"}`);
  }
  for (const metric of sourceMetrics) {
    const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metric.id}"]`);
    const button = page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metric.id}"]`);
    await input.waitFor({ state: "attached", timeout: 5000 });
    if (await input.getAttribute("aria-hidden") === "true") await button.click();
    await input.waitFor({ state: "visible", timeout: 5000 });
    const value = movement.values[metric.name];
    if (!Number.isFinite(value)) throw new Error(`No fixture value for ${metric.name} on ${movement.name}`);
    await input.fill(String(value));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  if (actualRir != null) {
    const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${active.id}_1_rir"]`);
    const rirButton = page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]`);
    if (await rir.getAttribute("aria-hidden") === "true") await rirButton.click();
    await rir.waitFor({ state: "visible", timeout: 5000 });
    await rir.fill(String(actualRir));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  await page.locator(`#workout .exercise.is-current [data-save="${active.id}_1"]`).click();
  await page.waitForFunction(({ id, setId, metricValues }) => {
    const set = window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.sets?.[setId];
    return set?.completion && typeof set.completion === "object" &&
      typeof set.completion.completedAt === "string" && Number.isFinite(Date.parse(set.completion.completedAt)) &&
      metricValues.every(({ id: metricId, value }) => Number(set.edited.metrics?.[metricId]) === value);
  }, { id: active.id, setId: active.setId, metricValues: sourceMetrics.map(metric => ({ id: metric.id, value: movement.values[metric.name] })) }, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function saveDay(page, day, movements) {
  const entered = await page.evaluate((label) => window.__repforgeEnterWorkout({ day: label }), day);
  if (!entered) throw new Error(`Could not enter ${day}`);
  await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus .exercise.is-current", { timeout: 10000 });
  for (const [index, movement] of movements.entries()) {
    await addMetricSet(page, movement, { actualRir: movement.id === PICKED[0].id ? 6 : null });
    if (index < movements.length - 1) {
      await page.locator("#workout .exercise.is-current [data-fnext]").click();
      const nextMovement = movements[index + 1];
      await page.waitForFunction((libraryId) => {
        const draft = window.__repforgeWorkoutDraft?.current?.();
        const selectedId = draft?.session?.selectedExerciseId;
        return !!selectedId && draft.exercises?.[selectedId]?.libraryId === libraryId;
      }, nextMovement.id, { timeout: 10000 });
    }
  }
  await page.locator("#workout .exercise.is-current [data-ffinish]").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await flush(page);
}

function expectedMetrics(movement) {
  const source = sourceById.get(movement.id);
  return source.exerciseMetrics.map((id) => {
    const metric = CATALOG.uuidIndex[id];
    const unit = metric.name === "Weight" || metric.name === "Assistance weight" || metric.name === "Weight per side" || metric.name === "Weight per side persistent" ? "kg"
      : metric.name === "Duration" || metric.name === "Duration per side" ? "seconds"
        : metric.name.startsWith("Distance") ? "metres" : "reps";
    return { metricId: id, value: movement.values[metric.name], unit };
  });
}

async function openSettingsFromProductionUi(page) {
  if (await page.locator("#firstRun:not(.hidden)").count()) {
    await page.locator("#firstRunCreate").click();
    await page.locator("#onboarding.active").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#onbCancel").click();
    const discard = page.locator("#entryCancelDiscard");
    await Promise.race([
      discard.waitFor({ state: "visible", timeout: 10000 }),
      page.locator("#onboarding.active").waitFor({ state: "detached", timeout: 10000 }),
    ]);
    if (await discard.isVisible()) await discard.click();
    await page.locator("#onboarding.active").waitFor({ state: "detached", timeout: 10000 });
  }
  if (!await page.locator("#settings.view.active").count()) {
    if (!await page.locator("#log.view.active").count()) {
      await page.locator('nav button[data-view="log"]').click();
      await page.locator("#log.view.active").waitFor({ state: "visible", timeout: 10000 });
    }
    await page.locator("#openSettings").click();
  }
  await page.locator("#settings.view.active").waitFor({ state: "visible", timeout: 10000 });
}

async function exportBackup(page) {
  await openSettingsFromProductionUi(page);
  const panel = page.locator("#dataBackupPanel");
  if (!await panel.evaluate((element) => element.classList.contains("is-open"))) await page.locator("#dataBackupRow").click();
  await page.locator("#exportJson").waitFor({ state: "visible", timeout: 10000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function importText(page, text, name = "catalog-metric-backup.json") {
  const bytes = Buffer.from(text, "utf8");
  await openSettingsFromProductionUi(page);
  const panel = page.locator("#dataImportPanel");
  if (!await panel.evaluate((element) => element.classList.contains("is-open"))) await page.locator("#dataImportRow").click();
  await page.locator("#importJson").waitFor({ state: "attached", timeout: 10000 });
  await page.evaluate(() => {
    const input = document.querySelector("#importJson");
    window.__catalogMetricUploadedFileBytes = new Promise((resolve) => {
      input.addEventListener("change", (event) => resolve(event.target.files?.[0]?.text() ?? null),
        { capture: true, once: true });
    });
  });
  await page.locator("#importJson").setInputFiles({ name, mimeType: "application/json", buffer: bytes });
  return page.evaluate(() => window.__catalogMetricUploadedFileBytes);
}

async function openBackupImport(page, text, name) {
  await importText(page, text, name);
  await page.locator("#importChoice").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 15000 });
  await flush(page);
}

async function main() {
  console.log("P067-S1: raw catalog → metric Focus → durable log/History/backup proof");
  const artifactDirectory = process.env.REPFORGE_ARTIFACT_DIR;
  if (artifactDirectory) {
    mkdirSync(artifactDirectory, { recursive: true });
    for (const name of ["catalog-metric-boot-errors.json", "catalog-metric-journey-error.json",
      "catalog-metric-journey-error.png", "catalog-metric-target-journey-error.json",
      "catalog-metric-target-journey-error.png"]) {
      rmSync(join(artifactDirectory, name), { force: true });
    }
  }
  const browser = await launchChromium();
  let sourceContext;
  let targetContext;
  let source = null;
  let target = null;
  let sourceErrors = [];
  let targetErrors = [];
  let stage = "launch";
  try {
    sourceContext = await browser.newContext({ locale: "en", serviceWorkers: "block" });
    source = await sourceContext.newPage();
    await source.setViewportSize({ width: 390, height: 844 });
    await installStorageLockGate(source);
    sourceErrors = captureBrowserErrors(source);
    source.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    stage = "source first boot";
    await source.goto(BASE);
    await waitForBootWithDiagnostics(source, sourceErrors);
    stage = "manual Build journey";
    await buildProgram(source);

    const built = await definitionSnapshot(source);
    const builtSlots = built.definition.days.flatMap((day) => day.slots);
    check(builtSlots.length === PICKED.length && PICKED.every((movement) => builtSlots.some((slot) => slot.exerciseId === movement.id)),
      "manual Build stores every selected current full UUID in the canonical ProgramDefinition", builtSlots.map((slot) => slot.exerciseId));
    for (const movement of PICKED) {
      const slot = builtSlots.find((candidate) => candidate.exerciseId === movement.id);
      const raw = sourceById.get(movement.id);
      const metrics = raw.exerciseMetrics;
      check(!!slot && same(slot.metricIds, metrics) && same(slot.metricDefinitions.map((entry) => entry.id), metrics),
        `${movement.name} keeps the source-ordered metric UUID composition`, slot?.metricIds);
    }
    const firstSlot = builtSlots.find((slot) => slot.exerciseId === PICKED[0].id);
    check(firstSlot?.setupNotes === "Rack set at the marked 45° stop" && firstSlot.prescriptionsByCycle[0].sets.length === 1 &&
      firstSlot.prescriptionsByCycle[0].sets[0].targets.reps?.min === 8 && firstSlot.prescriptionsByCycle[0].sets[0].targets.reps?.max === 12,
      "the manual projection preserves setup notes and the authored 8–12 repetition range", firstSlot);

    const reloadDefinition = built.definition;
    await reload(source);
    const afterReload = await definitionSnapshot(source);
    check(same(afterReload.definition, reloadDefinition), "normal reload preserves the canonical program definition exactly");
    await saveDay(source, "Day 1", PICKED.slice(0, 3));
    await saveDay(source, "Day 2", PICKED.slice(3));

    const saved = await replicas(source);
    const rows = saved.local?.log || [];
    check(rows.length === PICKED.length && same(saved.idb?.log, rows), `both durable replicas contain all ${PICKED.length} saved metric sets`, { local: rows.length, idb: saved.idb?.log?.length });
    for (const movement of PICKED) {
      const row = rows.find((candidate) => candidate.performedLibraryId === movement.id);
      const expected = expectedMetrics(movement);
      check(!!row && same(row.metricIds, expected.map((metric) => metric.metricId)) && same(row.metricValues, expected),
        `${movement.name} persists ordered numeric source metricValues and units`, row?.metricValues);
    }
    const zeroLoad = rows.find((row) => row.performedLibraryId === PICKED[1].id);
    const perSide = rows.find((row) => row.performedLibraryId === PICKED[3].id);
    check(zeroLoad?.metricValues?.[0]?.value === 0, "zero external load remains a numeric zero", zeroLoad?.metricValues);
    check(perSide?.loadingConvention === "per_side" && perSide.loadingContext?.externalLoadMultiplier == null,
      "per-side work records an unknown multiplier without silently doubling it", perSide);
    const highRir = rows.find((row) => row.performedLibraryId === PICKED[0].id);
    check(highRir?.rir === 6, "a finite performed RIR above the target range is preserved uncapped", highRir?.rir);

    await reload(source);
    await source.locator('nav button[data-view="history"]').click();
    await source.waitForSelector("#history.view.active", { timeout: 10000 });
    const renderedMetrics = [];
    const sessionIds = [...new Set(rows.map((row) => String(row.session)))];
    for (const sessionId of sessionIds) {
      await source.locator(`#sessions .hist-row[data-sess="${sessionId}"] .session__open`).click();
      const readPage = source.locator(`#sessions .session--read[data-reading="${sessionId}"]`);
      await readPage.waitFor({ state: "visible", timeout: 10000 });
      const sessionMetrics = await readPage.evaluate((root) => [...root.querySelectorAll("section[data-history-exercise-id]")].map((section) => {
        const headers = [...section.querySelectorAll(".histpage__cols .history-metric-grid .fx-col")];
        const cells = [...section.querySelectorAll("[data-history-metric-id]")];
        return {
          exerciseId: section.dataset.historyExerciseId,
          headers: headers.map((element) => element.textContent.trim()),
          cells: cells.map((element) => ({
            id: element.dataset.historyMetricId,
            value: Number(element.dataset.metricValue),
            unit: element.dataset.metricUnit,
            shownUnit: element.querySelector(".history-metric__unit")?.textContent.trim() || "",
            shownValue: element.querySelector(".history-metric__value")?.textContent.trim() || "",
            aria: element.getAttribute("aria-label") || "",
          })),
        };
      }));
      check(await readPage.isVisible(), `History opens the saved ${sessionId} session page`);
      renderedMetrics.push(...sessionMetrics);
      await source.locator("#history [data-history-back]").click();
      await source.locator(`#sessions .hist-row[data-sess="${sessionId}"] .session__open`).waitFor({ state: "visible", timeout: 10000 });
    }
    for (const movement of PICKED) {
      const expected = expectedMetrics(movement);
      const group = renderedMetrics.find((item) => item.exerciseId === movement.id);
      const sourceMetrics = sourceById.get(movement.id).exerciseMetrics;
      const visibleUnit = (unit) => unit === "kg" ? saved.local.settings.unit : unit === "metres" ? "m" : unit === "seconds" ? "s" : "";
      const metricCells = group?.cells || [];
      const headerAndCellEvidence = expected.every((metric, index) => {
        const cell = metricCells[index], header = group?.headers[index] || "";
        const unit = visibleUnit(metric.unit);
        const label = unit && header.endsWith(` (${unit})`) ? header.slice(0, -(` (${unit})`).length) : header;
        return cell?.id === metric.metricId && cell.value === metric.value && cell.unit === metric.unit &&
          cell.shownValue.includes(String(metric.value)) && cell.shownUnit === unit && label.length > 0 &&
          cell.aria.startsWith(`${label}:`);
      });
      check(!!group && same(metricCells.map((cell) => cell.id), sourceMetrics),
        `${movement.name} History displays metrics in the exact source UUID order`, metricCells.map((cell) => cell.id));
      check(headerAndCellEvidence, `${movement.name} History shows each localized label, canonical value, and visible unit`, { expected, group });
    }
    check(renderedMetrics.reduce((count, group) => count + group.cells.length, 0) === PICKED.reduce((count, movement) => count + expectedMetrics(movement).length, 0),
      "opened History sessions present all saved source-metric cells", renderedMetrics.map((group) => group.cells.map((item) => item.id)));
    const expectedMetricPairs = PICKED.flatMap((movement) => expectedMetrics(movement)
      .map((metric) => `${metric.metricId}:${metric.value}`)).sort();
    check(same(renderedMetrics.flatMap((group) => group.cells.map((item) => `${item.id}:${item.value}`)).sort(), expectedMetricPairs),
      "History's displayed metric cells retain the complete UUID/value multiset", renderedMetrics);

    const backup = await exportBackup(source);
    check(same(backup.programMeta?.programDefinition, saved.local.programMeta.programDefinition) && same(backup.log, rows),
      "ordinary backup export carries the canonical definition and metric log rows");
    targetContext = await browser.newContext({ locale: "en", serviceWorkers: "block" });
    target = await targetContext.newPage();
    await target.setViewportSize({ width: 390, height: 844 });
    targetErrors = captureBrowserErrors(target);
    target.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    stage = "backup target first boot";
    await target.goto(BASE);
    await waitForBootWithDiagnostics(target, targetErrors);
    await openBackupImport(target, JSON.stringify(backup), "catalog-metric-valid.json");
    const restored = await replicas(target);
    check(same(restored.local?.programMeta?.programDefinition, saved.local.programMeta.programDefinition) &&
      same(restored.local?.log, rows) && same(restored.idb?.log, rows),
      "the production Replace import restores the full program and actual metrics into both replicas");

    stage = "invalid backup refusal";
    for (const [label, mutate] of [
      ["unsupported metric composition", (value) => { value.programMeta.programDefinition.days[0].slots[0].metricIds.reverse(); }],
      ["unknown catalog UUID", (value) => { value.programMeta.programDefinition.days[0].slots[0].exerciseId = "ffffffffffffffffffffffffffffffff"; }],
    ]) {
      const invalid = structuredClone(backup);
      mutate(invalid);
      const rawText = JSON.stringify(invalid);
      const uploadedText = await importText(target, rawText, "invalid-catalog-metric.json");
      const before = await replicas(target);
      await target.waitForFunction(() => document.querySelector("#importChoice")?.open !== true &&
        (document.querySelector("#toast")?.textContent || "").trim().length > 0, undefined, { timeout: 10000 });
      await flush(target);
      const after = await replicas(target);
      check(uploadedText === rawText, `${label} rejection was exercised through the actual uploaded file bytes`);
      check(before.localRaw === after.localRaw && same(before.idb, after.idb),
        `${label} is refused without changing local or IndexedDB source state`, label);
    }

    stage = "malformed backup refusal";
    const malformed = "{\"programMeta\": {\"programDefinition\": ";
    const malformedBefore = await replicas(target);
    const malformedUploaded = await importText(target, malformed, "malformed-backup.json");
    await target.waitForFunction(() => document.querySelector("#importChoice")?.open !== true &&
      (document.querySelector("#toast")?.textContent || "").trim().length > 0, undefined, { timeout: 10000 });
    await flush(target);
    const malformedAfter = await replicas(target);
    check(malformedUploaded === malformed, "malformed backup is rejected from the actual uploaded file bytes");
    check(malformedBefore.localRaw === malformedAfter.localRaw && same(malformedBefore.idb, malformedAfter.idb),
      "malformed backup is refused while preserving both durable replicas");

    stage = "History metric edit with renderer re-entry";
    if (await source.locator("#settings.view.active").count()) await source.locator("#settingsBack").click();
    await source.locator('nav button[data-view="history"]').click();
    const firstMetricId = sourceById.get(PICKED[0].id).exerciseMetrics[0];
    const removedMetricId = sourceById.get(PICKED[2].id).exerciseMetrics[1];
    const historyBeforeEdit = await replicas(source);
    const firstRowBefore = historyBeforeEdit.local.log.find((row) => row.performedLibraryId === PICKED[0].id);
    const untouchedBefore = historyBeforeEdit.local.log.find((row) => row.performedLibraryId === PICKED[1].id);
    const removedBefore = historyBeforeEdit.local.log.find((row) => row.performedLibraryId === PICKED[2].id);
    const sessionId = firstRowBefore?.session;
    if (!sessionId || String(untouchedBefore?.session) !== String(sessionId) ||
      String(removedBefore?.session) !== String(sessionId)) throw new Error("History edit fixture rows must share one saved session");
    await source.locator(`#sessions .hist-row[data-sess="${sessionId}"] .session__open`).click();
    await source.locator(`.session--read[data-reading="${sessionId}"] [data-history-edit]`).click();
    // Several movements share a metric UUID (Weight), so address the row by
    // its rendered movement before choosing the metric cell.
    const rowMetric = (movement, metricId) =>
      `.session--edit input[data-ek$="|${metricId}"][aria-label^="${movement.name} "]`;
    const firstEk = await source.locator(rowMetric(PICKED[0], firstMetricId)).getAttribute("data-ek");
    const metricSelector = `.session--edit input[data-ek="${firstEk}"]`;
    await source.locator(metricSelector).fill("65");
    const removedIndex = await source.locator(rowMetric(PICKED[2], removedMetricId))
      .getAttribute("data-ek").then((value) => Number(String(value).split("|")[1]));
    if (!Number.isInteger(removedIndex)) throw new Error("History edit could not locate the retained session row to remove");
    await source.locator(`.session--edit button[data-edrm="${removedIndex}"]`).click();
    // Renderer re-entry is an explicit fault injection: row removal is an
    // inline tombstone by design, so it does not itself replace the DOM.
    await source.evaluate(() => window.__repforgeHistory.render());
    const valueAfterRerender = await source.locator(metricSelector).inputValue();
    check(valueAfterRerender === "65", "renderer re-entry preserves the edited source metric value", valueAfterRerender);
    await source.locator(`.session--edit [data-edsave="${sessionId}"]`).click();
    await source.waitForSelector(`.session--read[data-reading="${sessionId}"]`, { timeout: 15000 });
    await flush(source);
    const historyAfterEdit = await replicas(source);
    const firstRowAfter = historyAfterEdit.local.log.find((row) => row.performedLibraryId === PICKED[0].id);
    const untouchedAfter = historyAfterEdit.local.log.find((row) => row.performedLibraryId === PICKED[1].id);
    check(firstRowAfter?.metricValues?.[0]?.value === 65 && firstRowAfter?.load === 65 &&
      same(historyAfterEdit.idb?.log, historyAfterEdit.local.log),
      "History Save persists the edited canonical metric, legacy load projection, and both replicas", firstRowAfter);
    check(!historyAfterEdit.local.log.some((row) => row.performedLibraryId === PICKED[2].id),
      "History Save removes the explicitly removed set", historyAfterEdit.local.log.map((row) => row.performedLibraryId));
    check(!!untouchedBefore && !!untouchedAfter &&
      JSON.stringify(untouchedAfter.metricValues) === JSON.stringify(untouchedBefore.metricValues) &&
      JSON.stringify(untouchedAfter.rir ?? null) === JSON.stringify(untouchedBefore.rir ?? null) &&
      JSON.stringify(untouchedAfter.bodyweight ?? null) === JSON.stringify(untouchedBefore.bodyweight ?? null) &&
      JSON.stringify(untouchedAfter.loadingContext) === JSON.stringify(untouchedBefore.loadingContext),
      "an untouched source row retains exact metrics, units, RIR, bodyweight, and loading context", { before: untouchedBefore, after: untouchedAfter });
    check(firstRowAfter?.rir === firstRowBefore?.rir &&
      JSON.stringify(firstRowAfter?.loadingContext) === JSON.stringify(firstRowBefore?.loadingContext),
      "editing a metric retains that set's separate RIR and captured loading assumptions", firstRowAfter);

    // The catalog is a producer dependency. A failed reload must preserve the
    // exact durable source and leave a retry path; it cannot heal the program
    // to an empty legacy projection just because catalog details are absent.
    stage = "catalog unavailable reload and retry";
    const sourceBeforeCatalogFailure = await replicas(source);
    const sourceRecovery = await source.evaluate(() => Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1") || key.includes("recovery"))
        .sort().map((key) => [key, localStorage.getItem(key)])));
    let blockedFetches = 0;
    await source.route("**/assets/exercise-catalog.json*", async (route) => { blockedFetches++; await route.abort("failed"); });
    await source.reload({ waitUntil: "domcontentloaded" });
    await source.locator("#exerciseCatalogRecovery[open]").waitFor({ state: "visible", timeout: 10000 });
    check(blockedFetches > 0, "fault fixture refused the production raw-catalog request", blockedFetches);
    const afterCatalogFailure = await replicas(source);
    const afterRecovery = await source.evaluate(() => Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1") || key.includes("recovery"))
        .sort().map((key) => [key, localStorage.getItem(key)])));
    check(sourceBeforeCatalogFailure.localRaw === afterCatalogFailure.localRaw &&
      same(sourceBeforeCatalogFailure.idb, afterCatalogFailure.idb) && same(sourceRecovery, afterRecovery),
      "catalog-unavailable boot preserves exact durable and recovery source bytes");
    const unavailable = await source.evaluate(() => ({
      definition: JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.programDefinition,
      notice: document.querySelector("#exerciseCatalogRecovery")?.textContent.trim() || "",
      retry: !!document.querySelector("#retryExerciseCatalog"),
      booted: window.__repforgeBooted === true,
    }));
    check(same(unavailable.definition, saved.local.programMeta.programDefinition) &&
      /catalog|library|exercise/i.test(unavailable.notice) && unavailable.retry && !unavailable.booted,
      "catalog failure blocks app normalization, shows an actionable retry, and leaves the saved definition readable", unavailable);
    await source.unroute("**/assets/exercise-catalog.json*");
    await source.locator("#retryExerciseCatalog").click();
    await source.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.programDefinition?.days?.length === 7,
      undefined, { timeout: 10000 });
    check(same((await definitionSnapshot(source)).definition, saved.local.programMeta.programDefinition),
      "retry after the catalog returns recovers the saved canonical program");

    stage = "malformed catalog asset refusal and retry";
    const shapeBefore = await replicas(source);
    const shapeRecoveryBefore = await source.evaluate(() => Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1") || key.includes("recovery"))
        .sort().map((key) => [key, localStorage.getItem(key)])));
    await source.route("**/assets/exercise-catalog.json*", (route) => route.fulfill({
      status: 200, contentType: "application/json; charset=utf-8", body: CATALOG_SHAPE_FAILURE,
    }));
    await source.reload({ waitUntil: "domcontentloaded" });
    await source.locator("#exerciseCatalogRecovery[open]").waitFor({ state: "visible", timeout: 10000 });
    const malformedCatalog = await source.evaluate(() => ({
      error: window.__repforgeCatalogUnavailable || "",
      booted: window.__repforgeBooted === true,
      notice: document.querySelector("#exerciseCatalogRecovery")?.textContent.trim() || "",
    }));
    check(/integrity|catalog|library|exercise/i.test(malformedCatalog.error) && !malformedCatalog.booted,
      "valid-JSON catalog corruption is rejected against the unchanged release pin before boot", malformedCatalog);
    const shapeAfterFailure = await replicas(source);
    const shapeRecoveryAfterFailure = await source.evaluate(() => Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1") || key.includes("recovery"))
        .sort().map((key) => [key, localStorage.getItem(key)])));
    check(shapeBefore.localRaw === shapeAfterFailure.localRaw && same(shapeBefore.idb, shapeAfterFailure.idb) &&
      same(shapeRecoveryBefore, shapeRecoveryAfterFailure),
      "corrupt-catalog boot preserves both durable replicas and exact recovery bytes");
    await source.locator("#retryExerciseCatalog").click();
    await source.waitForFunction(() => /still unavailable/i.test(
      document.querySelector("#exerciseCatalogRecoveryStatus")?.textContent || ""), undefined, { timeout: 10000 });
    check(!await source.evaluate(() => window.__repforgeBooted === true),
      "retry refuses the same corrupted catalog and stays behind the recovery gate");
    await source.unroute("**/assets/exercise-catalog.json*");
    await source.locator("#retryExerciseCatalog").click();
    await source.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.programDefinition?.days?.length === 7,
      undefined, { timeout: 10000 });
    const afterShapeRetry = await replicas(source);
    check(same(afterShapeRetry.local?.programMeta?.programDefinition, shapeBefore.local?.programMeta?.programDefinition) &&
      same(afterShapeRetry.idb, shapeBefore.idb),
      "retry after restoring the checked catalog opens the same saved program");
  } catch (error) {
    const page = target && stage.includes("backup") ? target : source;
    const messages = page === target ? targetErrors : sourceErrors;
    const diagnostics = await captureJourneyFailure(page, stage, messages, error, "catalog-metric");
    throw new Error(`Journey diagnostic: ${JSON.stringify(diagnostics)}`);
  } finally {
    await targetContext?.close();
    await sourceContext?.close();
    await browser.close();
  }

  console.log(`\nP067-S1 result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
