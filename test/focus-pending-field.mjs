#!/usr/bin/env node
/**
 * Plan 064 audit RT-03 and RT-04, proved at the production boundary.
 *
 * RT-03: a field write that is still waiting for its durable acknowledgement
 * must survive a rebuild of the shelf. The lock that serialises every DraftV2
 * write across tabs (`repforge:state-write`) is held for real, so the edit stays
 * unacknowledged while the lifter keeps working; nothing about the reducer, the
 * CAS store, the input handlers or the save path is replaced. Once the lock is
 * released the live input, the shelf label, the open ledger row, the
 * acknowledged draft and the saved log must all say the same thing.
 *
 * RT-04: every operation of the rest clock stays reachable from the presets
 * sheet when the inline rest pads are not on screen (a field was tapped, or the
 * text is at 200%): Pause and Resume hold and release the same remaining time.
 *
 * Run: node test/focus-pending-field.mjs   (REPFORGE_URL points at a static server)
 */
import { launchChromium, openShelfField } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly, openLoggedSets } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const LOCK = "repforge:state-write";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

async function persist(page, src) {
  await page.evaluate(
    async ({ k, src }) => {
      const blob = JSON.parse(localStorage.getItem(k) || "{}");
      // eslint-disable-next-line no-new-func
      new Function("s", "w", src)(blob, window);
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, src }
  );
}

async function settle(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
/** Shelf field ids: the seed program's sets are metric-backed (Weight, Reps); RIR stays its own field. */
const FIELD_IDS = { load: `metric_${WEIGHT}`, reps: `metric_${REPS}`, rir: "rir" };

/**
 * A fresh device with the seed program on its first exercise, set 1 typed as
 * 50 kg × 6 the way a lifter enters it. The seed program is manual (no
 * suggested load), so the starting value every pad tap below steps from is
 * the lifter's own, acknowledged before the lock is taken.
 */
async function boot(page, { rirMode = "numeric", restSec = 90, fontScale = 1 } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    if (window.stopRest) window.stopRest();
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, DRAFT);
  await persist(page, `
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: ${JSON.stringify(rirMode)}, restSec: ${restSec} };
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  if (fontScale !== 1) await page.evaluate((s) => { document.documentElement.style.fontSize = `${s * 100}%`; }, fontScale);
  await page.evaluate(async () => {
    await window.__repforgeEnterWorkout({});
    window.__repforgeFocus.to(0);
  });
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf", { state: "attached", timeout: 5000 });
  await typeField(page, "load", "50");
  await typeField(page, "reps", "6");
  await page.locator(field("rir")).click();
}

const SHELF = "#workout .exercise.is-current .focus-shelf";
const field = (id) => `${SHELF} [data-shelf-field="${FIELD_IDS[id] || id}"]`;
const inputFor = (id, n = 1) => `${SHELF} .shelf__input[data-k$="_${n}_${FIELD_IDS[id] || id}"]`;

/** Tap a field until its input is open, type, and wait for the draft to acknowledge it. */
async function typeField(page, id, value) {
  const input = page.locator(inputFor(id));
  for (let tap = 0; tap < 2 && await input.getAttribute("aria-hidden") === "true"; tap++) await openShelfField(page, field(id));
  await input.fill(value);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}
async function failLoadEdit(page, value) {
  await page.evaluate((checkpointKey) => {
    const original = Storage.prototype.setItem;
    window.__restoreCheckpointQuotaFault = () => { Storage.prototype.setItem = original; };
    window.__checkpointQuotaFaults = 0;
    Storage.prototype.setItem = function (key, stored) {
      if (this === window.localStorage && key === checkpointKey && window.__checkpointQuotaFaults === 0) {
        window.__checkpointQuotaFaults++;
        throw new DOMException("proof draft checkpoint quota", "QuotaExceededError");
      }
      return original.call(this, key, stored);
    };
  }, `${DRAFT}:v2-checkpoint`);
  try {
    await typeField(page, "load", value);
    await page.waitForSelector("#draftRecovery:not(.hidden)", { timeout: 5000 });
  } finally {
    const faultCount = await page.evaluate(() => {
      window.__restoreCheckpointQuotaFault?.();
      delete window.__restoreCheckpointQuotaFault;
      return window.__checkpointQuotaFaults;
    });
    assert(faultCount === 1, "RT-03: the field write hit the real DraftV2 checkpoint storage boundary", faultCount);
  }
}
const pad = (dir) => `${SHELF} .shelf__pad[data-dir="${dir}"]`;

/** Hold the real cross-tab write lock: every DraftV2 write now waits. */
async function holdLock(page) {
  await page.evaluate((name) => new Promise((resolve) => {
    navigator.locks.request(name, () => new Promise((release) => { window.__releaseStateLock = release; resolve(); }));
  }), LOCK);
}
async function releaseLock(page) {
  await page.evaluate(() => { window.__releaseStateLock(); delete window.__releaseStateLock; });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForTimeout(80);
}

/** What the lifter sees for one field of the active set, and what the acknowledged draft holds. */
const readField = (page, id, n = 1) =>
  page.evaluate(({ id, n, metricIds }) => {
    const card = document.querySelector("#workout .exercise.is-current");
    const shelf = card.querySelector(".focus-shelf");
    const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const metricId = metricIds[id] || null;
    const input = shelf.querySelector(metricId ? `.shelf__input[data-k$="_${n}_metric_${metricId}"]`
      : `.shelf__input[data-k$="_${n}_${id === "effort" ? "rir" : id}"]`);
    const fieldEl = shelf.querySelector(metricId ? `.shelf__field[data-metric="${metricId}"]`
      : `.shelf__field[data-field="${id === "effort" ? "rir" : id}"]`);
    const open = card.querySelector(".ledgerline--open");
    const col = id === "effort" ? "rir" : id;
    const target = window.__repforgeWorkoutDraft.target(`${card.dataset.ex}_${n}`);
    const set = window.__repforgeWorkoutDraft.current().exercises[target.exerciseInstanceId].sets[target.setId];
    return {
      input: input ? input.value : null,
      label: text(fieldEl?.querySelector(".shelf__val")),
      ledger: text(open?.querySelector(`[data-lv="${col}"]`)),
      draft: (metricId ? set.edited.metrics?.[metricId] : set.edited[id]) ?? null,
      effortAttr: fieldEl?.querySelector("[data-effspin]")?.dataset.e ?? null,
    };
  }, { id, n, metricIds: { load: WEIGHT, reps: REPS } });

const num = (s) => (s == null ? NaN : Number(String(s).replace(/[^\d.\-]/g, "")));
function agree(name, snap, expected) {
  assert(num(snap.input) === expected && num(snap.label) === expected && num(snap.ledger) === expected && num(snap.draft) === expected,
    `${name}: live input, label, ledger and acknowledged draft all read ${expected}`, snap);
}

async function main() {
  const browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // ---- RT-03 a: the audit's reproduction, through to the saved log ---------
  phase("RT-03: a pad tap, then a field switch, while the write waits for the lock");
  await boot(page);
  await page.locator(field("load")).click();
  const start = await readField(page, "load");
  agree("RT-03 the typed starting load", start, 50);
  await holdLock(page);
  await page.locator(pad(1)).click();
  await page.locator(field("rir")).click(); // rebuilds the shelf while the load write is unacknowledged
  const pending = await readField(page, "load");
  assert(num(pending.input) === num(pending.label) && num(pending.label) === num(pending.ledger),
    "RT-03: while the write waits, input, label and ledger show one value", pending);
  await releaseLock(page);
  agree("RT-03 pad tap then RIR selected", await readField(page, "load"), 52.5);
  await page.locator(".focus-shelf .saveset").first().click();
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"] && true);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.evaluate(() => window.stopRest?.());
  // Save the session through the real Finish action.
  const finished = await finishEarly(page);
  assert(finished && finished.status !== "error", "RT-03: the session saves through the real Finish action", finished);
  const logRows = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter((r) => r.exerciseId === "seed-ex-1"), KEY);
  const first = logRows.find((r) => r.set === 1);
  assert(first && Number(first.load) === 52.5, "RT-03: the first immutable saved row holds the load the lifter was shown", logRows);

  // ---- b: several queued pad taps across rebuilds ---------------------------
  phase("RT-03: queued pad taps are not lost across rebuilds");
  await boot(page);
  await page.locator(field("load")).click();
  await holdLock(page);
  await page.locator(pad(1)).click();
  await page.locator(field("rir")).click();
  await page.locator(field("load")).click();
  await page.locator(pad(1)).click(); // reads the rebuilt control: it must already show the first tap
  await page.locator(field("reps")).click();
  await page.locator(field("load")).click();
  await page.locator(pad(1)).click();
  await releaseLock(page);
  agree("RT-03 three queued +2.5 taps over three rebuilds", await readField(page, "load"), 57.5);

  // ---- c: a typed value ------------------------------------------------------
  phase("RT-03: a typed edit survives the rebuild");
  await boot(page);
  // Load is the selected field, so this tap is the second one: it opens the wheel, whose keyboard button opens the input.
  await openShelfField(page, field("load"));
  await holdLock(page);
  await page.locator(inputFor("load")).fill("57.5");
  await page.locator(field("reps")).click(); // rebuild
  const typed = await readField(page, "load");
  assert(num(typed.label) === 57.5 && num(typed.ledger) === 57.5 && num(typed.input) === 57.5,
    "RT-03: the rebuilt shelf shows the typed value before it is acknowledged", typed);
  await releaseLock(page);
  agree("RT-03 typed 57.5 then Reps selected", await readField(page, "load"), 57.5);

  // ---- d: reps and numeric RIR ----------------------------------------------
  phase("RT-03: reps and RIR pad taps");
  await boot(page);
  await page.locator(field("reps")).click();
  const reps0 = num((await readField(page, "reps")).input);
  const rir0 = num((await readField(page, "rir")).input);
  await holdLock(page);
  await page.locator(pad(1)).click();
  await page.locator(field("rir")).click();
  await page.locator(pad(-1)).click();
  await page.locator(field("load")).click();
  await releaseLock(page);
  const reps = await readField(page, "reps");
  const rir = await readField(page, "rir");
  assert(num(reps.input) === num(reps.label) && num(reps.label) === num(reps.ledger) && num(reps.ledger) === num(reps.draft) && num(reps.draft) === reps0 + 1,
    "RT-03: reps (+1) agree in input, label, ledger and draft", { reps0, reps });
  assert(num(rir.input) === num(rir.label) && num(rir.label) === num(rir.ledger) && num(rir.ledger) === num(rir.draft) && num(rir.draft) === rir0 - 1,
    "RT-03: RIR (-1) agrees in input, label, ledger and draft", { rir0, rir });

  // ---- e: effort mode -------------------------------------------------------
  phase("RT-03: effort mode");
  await boot(page, { rirMode: "effort" });
  await page.locator(field("rir")).click();
  const effort0 = await readField(page, "effort");
  await holdLock(page);
  await page.locator(`${SHELF} [data-effchip][data-e="easy"]`).click();
  await page.locator(field("load")).click(); // rebuild
  const effortWaiting = await readField(page, "effort");
  await page.locator(field("rir")).click();
  await page.locator(`${SHELF} [data-effchip][data-e="max"]`).click(); // the second choice reads the rebuilt chips
  await releaseLock(page);
  const effort1 = await readField(page, "effort");
  assert(effort1.label && effort1.label === effort1.ledger && String(effort1.draft).toLowerCase() === effort1.effortAttr,
    "RT-03: effort label, ledger, control and acknowledged draft agree after two choices across rebuilds", { effort0, effortWaiting, effort1 });
  assert(effortWaiting.label === effortWaiting.ledger && effortWaiting.label !== effort0.label && effort1.label !== effortWaiting.label,
    "RT-03: each choice moved the word, and the rebuilt shelf kept the first one", { effort0, effortWaiting, effort1 });

  // ---- f: exercise navigation while waiting ---------------------------------
  phase("RT-03: leaving the exercise while the write waits");
  await boot(page);
  await page.locator(field("load")).click();
  await holdLock(page);
  await page.locator(pad(1)).click();
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await page.waitForSelector('#workout .exercise.is-current[data-ex="seed-ex-2"]', { timeout: 5000 });
  const otherBefore = await readField(page, "load");
  await releaseLock(page);
  const otherAfter = await readField(page, "load");
  assert(otherBefore.label === otherAfter.label && otherBefore.ledger === otherAfter.ledger,
    "RT-03: the acknowledgement does not touch the exercise the lifter moved to", { otherBefore, otherAfter });
  await page.evaluate(() => window.__repforgeFocus.to(0));
  await page.waitForSelector('#workout .exercise.is-current[data-ex="seed-ex-1"]', { timeout: 5000 });
  agree("RT-03 back on the edited exercise", await readField(page, "load"), 52.5);

  // ---- g: correcting a logged set -------------------------------------------
  phase("RT-03: correcting a logged set across a rebuild");
  const corrected = {};
  for (const rebuild of [false, true]) {
    await boot(page, { restSec: 0 });
    await page.locator(".focus-shelf .saveset").first().click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.waitForSelector("#workout .exercise.is-current .ledgerline[data-editn=\"1\"]", { state: "attached" });
    await openLoggedSets(page);
    await page.waitForSelector(`#workout .exercise.is-current .ledgerline[data-editn="1"]`);
    await page.locator(`#workout .exercise.is-current .ledgerline[data-editn="1"]`).click();
    await page.waitForSelector(`${SHELF}.is-editing`);
    await page.locator(field("rir")).click();
    if (rebuild) await holdLock(page);
    await page.locator(pad(-1)).click();
    if (rebuild) await page.locator(field("load")).click(); // rebuild
    if (rebuild) await page.locator(field("rir")).click();
    await page.locator(pad(-1)).click();
    if (rebuild) {
      await page.locator(field("reps")).click(); // rebuild
      await releaseLock(page);
    } else {
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    }
    await page.waitForTimeout(300);
    corrected[rebuild] = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const ex = draft.exercises["seed-ex-1"];
      return ex.setOrder.map((id) => ({ ord: ex.sets[id].ordinal, rir: ex.sets[id].edited.rir ?? null, metrics: ex.sets[id].edited.metrics, suggested: ex.sets[id].programmed.suggestedLoad ?? null, reps: ex.sets[id].programmed.suggestedReps ?? null }));
    });
  }
  assert(JSON.stringify(corrected[true]) === JSON.stringify(corrected[false]),
    "RT-03: correcting a logged set through two pad taps across a rebuild ends on the same draft as without one", corrected);

  // ---- h: failed and stale writes --------------------------------------------
  phase("RT-03: recovery takes over an in-flight edit, and Retry keeps it through another edit");
  await boot(page);
  await page.locator(field("load")).click();
  await holdLock(page);
  const recoveryStartRevision = await page.evaluate(() => window.__repforgeWorkoutDraft.current().revision);
  await page.evaluate(() => {
    window.__repforgeQueuedPriorWrite = window.__repforgeWorkoutDraft.dispatch("setSessionNotes", { value: "queued before field edit" });
  });
  const queuedPriorWrite = await page.evaluate(async (name) => {
    const locks = await navigator.locks.query();
    return locks.held.some(lock => lock.name === name) && locks.pending.some(lock => lock.name === name);
  }, LOCK);
  assert(queuedPriorWrite, "RT-03: an earlier draft write is waiting on the held cross-tab lock");
  await page.locator(pad(1)).click();
  await page.waitForFunction((sel) => document.querySelector(sel)?.value === "52.5", inputFor("load"));
  await page.evaluate(() => { window.__repforgeDraftFault = "persist-failure"; });
  await releaseLock(page);
  const priorWriteApplied = await page.evaluate(async (revision) => {
    const result = await window.__repforgeQueuedPriorWrite;
    return result.status === "applied" && window.__repforgeWorkoutDraft.current().revision === revision + 1;
  }, recoveryStartRevision);
  assert(priorWriteApplied, "RT-03: the earlier write settles before recovery starts");
  await page.waitForSelector("#draftRecovery:not(.hidden)", { timeout: 5000 });
  await page.locator(field("rir")).click(); // rebuild after the failed write
  const failed = await readField(page, "load");
  assert(num(failed.draft) === 50 && num(failed.input) === 52.5 && num(failed.label) === 52.5 && num(failed.ledger) === 52.5,
    "RT-03: recovery shows the exact in-flight value while the acknowledged draft remains unchanged", failed);
  assert((await page.locator("#draftRecoveryPending").textContent()).includes("52.5"), "RT-03: the recovery banner names the pending value");
  await page.evaluate(() => { delete window.__repforgeDraftFault; });
  await holdLock(page);
  await page.locator("#draftRecoveryRetry").click();
  await page.waitForFunction(() => document.querySelector("#draftRecovery")?.classList.contains("is-pending"));
  const repsInput = page.locator(inputFor("reps"));
  for (let tap = 0; tap < 2 && await repsInput.getAttribute("aria-hidden") === "true"; tap++) await openShelfField(page, field("reps"));
  await repsInput.fill("7"); // queued behind Retry while recovery still owns the failed load edit
  const inFlightReps = await readField(page, "reps");
  assert((await page.locator("#draftRecovery").isVisible()) && num(inFlightReps.input) === 7,
    "RT-03: a separate edit remains live while Retry is in flight", inFlightReps);
  await releaseLock(page);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  assert(await page.locator("#draftRecovery").isHidden(), "RT-03: successful Retry clears its recovery record");
  agree("RT-03 after Retry", await readField(page, "load"), 52.5);
  const retriedReps = await readField(page, "reps");
  assert(num(retriedReps.input) === 7 && num(retriedReps.label) === 7 && num(retriedReps.ledger) === 7 && num(retriedReps.draft) === 7,
    "RT-03: clearing recovery leaves the queued edit visible and durable", retriedReps);
  await page.locator(".focus-shelf .saveset").first().click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"]
    && Object.values(window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"].sets).some(set => set.ordinal === 1 && set.completion !== "pending"));
  const retriedSave = await finishEarly(page);
  const retriedRows = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter(row => row.exerciseId === "seed-ex-1"), KEY);
  const retriedRow = retriedRows.find(row => row.set === 1);
  assert(retriedSave && retriedRow && Number(retriedRow.load) === 52.5 && Number(retriedRow.reps) === 7,
    "RT-03: the retried value is the value in the immutable saved row", { retriedSave, retriedRow });

  phase("RT-03: Back to Today preserves the exact failed field through a shelf rebuild and Retry");
  await boot(page);
  await typeField(page, "load", "50.5");
  await failLoadEdit(page, "100");
  await page.locator("#leaveWorkout").click();
  await page.waitForFunction(() => document.activeElement?.id === "draftRecovery", undefined, { timeout: 5000 });
  await page.locator(field("rir")).click();
  const backRecovery = await readField(page, "load");
  const backRecoveryUi = await page.evaluate(() => ({
    banner: document.querySelector("#draftRecoveryPending")?.textContent || "",
    copyVisible: !document.querySelector("#draftRecoveryCopy")?.classList.contains("hidden"),
  }));
  assert(num(backRecovery.input) === 100 && num(backRecovery.label) === 100 && num(backRecovery.ledger) === 100 &&
    num(backRecovery.draft) === 50.5 && backRecoveryUi.banner.includes("100") && backRecoveryUi.copyVisible,
    "RT-03: Back to Today and a shelf rebuild keep the pending load, banner, and Copy action aligned while the draft remains acknowledged at 50.5",
    { backRecovery, backRecoveryUi });
  await page.locator("#draftRecoveryRetry").click();
  await page.locator("#draftRecovery").waitFor({ state: "hidden", timeout: 5000 });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  agree("RT-03 Back recovery Retry", await readField(page, "load"), 100);
  await page.locator(".focus-shelf .saveset").first().click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForFunction(() => Object.values(window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"].sets)
    .some(set => set.ordinal === 1 && set.completion !== "pending"));
  const backSave = await finishEarly(page);
  const backRows = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter(row => row.exerciseId === "seed-ex-1"), KEY);
  const backRow = backRows.find(row => row.set === 1);
  assert(backSave && backRow && Number(backRow.load) === 100 && Number(backRow.reps) === 6,
    "RT-03: Back recovery Retry saves the load shown in every field surface", { backSave, backRow });

  phase("RT-03: a rejected follow-up field edit redraws from its real owner and returns focus to recovery");
  await boot(page);
  await failLoadEdit(page, "100");
  await typeField(page, "reps", "9");
  const rejectedReps = await readField(page, "reps");
  const rejectedRecoveryUi = await page.evaluate(() => ({
    focus: document.activeElement?.id || "",
    banner: document.querySelector("#draftRecoveryPending")?.textContent || "",
  }));
  assert(num(rejectedReps.input) === 6 && num(rejectedReps.label) === 6 && num(rejectedReps.ledger) === 6 &&
    num(rejectedReps.draft) === 6 && rejectedRecoveryUi.focus === "draftRecovery" && rejectedRecoveryUi.banner.includes("100"),
    "RT-03: a rejected reps edit is not shown as accepted and recovery keeps focus", { rejectedReps, rejectedRecoveryUi });
  await page.locator("#draftRecoveryRetry").click();
  await page.locator("#draftRecovery").waitFor({ state: "hidden", timeout: 5000 });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  agree("RT-03 follow-up recovery Retry", await readField(page, "load"), 100);
  agree("RT-03 rejected follow-up reps", await readField(page, "reps"), 6);
  await page.locator(".focus-shelf .saveset").first().click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForFunction(() => Object.values(window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"].sets)
    .some(set => set.ordinal === 1 && set.completion !== "pending"));
  const followupSave = await finishEarly(page);
  const followupRows = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter(row => row.exerciseId === "seed-ex-1"), KEY);
  const followupRow = followupRows.find(row => row.set === 1);
  assert(followupSave && followupRow && Number(followupRow.load) === 100 && Number(followupRow.reps) === 6,
    "RT-03: Retry saves the 100 × 6 values the lifter saw", { followupSave, followupRow });

  phase("RT-03: a stale write (another tab won the lock first) ends on the draft the other tab saved");
  await boot(page);
  await page.locator(field("load")).click();
  await holdLock(page);
  // The other tab's write queues on the lock first, then this tab's edit.
  await page.evaluate(() => {
    const api = window.__repforgeWorkoutDraft, draft = api.current();
    const next = window.RepForgeWorkoutDraft.reduce(draft, {
      type: "setSessionNotes", value: "other tab", operationId: "other-tab-op", expectedRevision: draft.revision,
      updatedAt: new Date().toISOString(), writer: { installationId: "other", tabId: "other-tab", operationId: "other-tab-op" },
    });
    window.__otherTabWrite = api.cas({ expectedDraftId: draft.draftId, expectedRevision: draft.revision,
      nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)), operationId: "other-tab-op" });
  });
  await page.locator(pad(1)).click();
  await page.locator(field("rir")).click();
  await releaseLock(page);
  const otherTab = await page.evaluate(async () => (await window.__otherTabWrite).status);
  const stale = await readField(page, "load");
  assert(otherTab === "applied" && !!(await page.evaluate(() => window.__repforgeWorkoutDraft.recovery())),
    "RT-03: the other tab's write applied and this tab's edit went to recovery", { otherTab });
  const staleBanner = await page.evaluate(() => {
    const r = window.__repforgeWorkoutDraft.recovery();
    return { kind: r?.kind, status: r?.status, reload: !document.querySelector("#draftRecoveryReload")?.classList.contains("hidden") };
  });
  console.log("    " + JSON.stringify(staleBanner));
  assert(num(stale.input) === 52.5 && /52\.5/.test(await page.locator("#draftRecoveryPending").textContent()),
    "RT-03: stale — the recovery banner carries the value this tab could not save", stale);
  // The banner owns the way out: reloading the latest draft redraws every surface from what was saved.
  await page.locator(staleBanner.reload ? "#draftRecoveryReload" : "#draftRecoveryRetry").click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForTimeout(150);
  const reloaded = await readField(page, "load");
  assert(num(reloaded.input) === num(reloaded.label) && num(reloaded.label) === num(reloaded.ledger) && num(reloaded.ledger) === num(reloaded.draft),
    "RT-03: stale — after the banner's action, input, label, ledger and draft agree", reloaded);

  // ---- RT-04 -----------------------------------------------------------------
  // The rest timer redesign (owner-approved mock, 2026-10-23): the rest lives in the tab over the shelf and the sheet
  // behind it. Pause and Resume are the sheet's one primary control (named by its label), reachable at every moment.
  const clock = (p) => p.evaluate(() => document.querySelector("#restTab .resttab__time")?.textContent?.trim());
  const secs = (s) => { const m = /^(\d+):(\d\d)$/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : NaN; };
  const holdLabel = (p) => p.locator("#restHold").getAttribute("aria-label");
  async function startRestByLogging(p) {
    await p.locator(".focus-shelf .saveset").first().click();
    await p.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await p.waitForSelector("#restTab", { timeout: 5000 });
    await p.waitForTimeout(200);
  }
  async function sheetHold(p) {
    await p.locator("#restTab").click();
    await p.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    return p.locator("#restHold");
  }
  async function closeSheet(p) {
    await p.locator("#restSheetClose").click();
    await p.waitForSelector("#restSheet", { state: "hidden", timeout: 5000 });
  }

  phase("RT-04: Pause/Resume is in the sheet behind the tab, and the shelf keeps its field pads");
  await boot(page, { restSec: 90 });
  await startRestByLogging(page);
  assert(!(await page.locator("#workout .exercise.is-current .restpad, #workout [data-rest-act]").count()), "RT-04: the shelf has no rest pads; its pads are the field's");
  let hold = await sheetHold(page);
  assert((await hold.count()) === 1 && (await hold.isVisible()) && (await hold.isEnabled()) && /pause/i.test(await holdLabel(page)),
    "RT-04: the sheet offers Pause while the rest runs", await holdLabel(page));
  await hold.click();
  const heldAt = secs(await clock(page));
  assert(/resume/i.test(await holdLabel(page)), "RT-04: it reads Resume while the clock is held", await holdLabel(page));
  await closeSheet(page);
  await page.locator(field("reps")).click(); // another field: the load is already selected, and a second tap opens its wheel
  await page.waitForTimeout(1300);
  assert(secs(await clock(page)) === heldAt, "RT-04: the held clock did not move, a field tap and all", { heldAt, now: await clock(page) });
  hold = await sheetHold(page);
  await hold.click();
  assert(/pause/i.test(await holdLabel(page)), "RT-04: after Resume the control offers Pause");
  await page.waitForTimeout(1300);
  const resumedAt = secs(await clock(page));
  assert(resumedAt <= heldAt && resumedAt >= heldAt - 3, "RT-04: Resume continues from the remaining time that was held", { heldAt, resumedAt });
  await hold.click();
  const reheld = secs(await clock(page));
  await page.waitForTimeout(1200);
  assert(secs(await clock(page)) === reheld, "RT-04: the sheet can pause again", { reheld });
  await page.locator("#restStop").click();
  await page.waitForFunction(() => !document.querySelector("#restTab"), undefined, { timeout: 5000 });
  await boot(page, { restSec: 90 });
  await page.evaluate(() => window.openRestSheet());
  await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
  assert((await page.locator("#restHold").getAttribute("data-mode")) === "start" && await page.locator("#restReset").isDisabled() && await page.locator("#restStop").isDisabled(),
    "RT-04: with no rest running the primary control offers Start, and Restart and End rest wait");
  await closeSheet(page);

  phase("RT-04: at 200% text, start, pause, edit a field, resume the same remaining time");
  await boot(page, { restSec: 90, fontScale: 2 });
  assert(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) > 16.1), "RT-04: the root text is scaled");
  await startRestByLogging(page);
  hold = await sheetHold(page);
  await hold.click();
  const largeHeld = secs(await clock(page));
  assert(/resume/i.test(await holdLabel(page)), "RT-04: the sheet pauses the clock at 200%");
  const box = await hold.boundingBox();
  const sheetBox = await page.locator("#restSheet").boundingBox();
  assert(box && box.x >= sheetBox.x - 1 && box.x + box.width <= sheetBox.x + sheetBox.width + 1 && box.width > 40 && box.height >= 40,
    "RT-04: the control fits the sheet and meets the target size at 200%", { box, sheetBox });
  await closeSheet(page);
  await page.locator(field("reps")).click(); // another field: the load is already selected, and a second tap opens its wheel
  await page.waitForFunction(() => !document.querySelector("#workout .motion-fade-out"), undefined, { timeout: 3000 });
  await page.locator(pad(1)).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForTimeout(1200);
  assert(secs(await clock(page)) === largeHeld, "RT-04: editing a field does not move the held clock", { largeHeld, now: await clock(page) });
  hold = await sheetHold(page);
  await hold.click();
  await page.waitForTimeout(1300);
  const largeResumed = secs(await clock(page));
  assert(largeResumed <= largeHeld && largeResumed >= largeHeld - 3, "RT-04: Resume continues from the held remaining time at 200%", { largeHeld, largeResumed });
  await closeSheet(page);

  phase("RT-04: while correcting a logged set");
  await boot(page, { restSec: 90 });
  await startRestByLogging(page);
  hold = await sheetHold(page);
  await hold.click();
  const correctHeld = secs(await clock(page));
  await closeSheet(page);
  await openLoggedSets(page);
  await page.locator(`#workout .exercise.is-current .ledgerline[data-editn="1"]`).click();
  await page.waitForSelector(`${SHELF}.is-editing`);
  await page.waitForFunction(() => !document.querySelector("#workout .motion-fade-out"), undefined, { timeout: 3000 });
  assert(await page.locator("#restTab").count() === 1, "RT-04: while correcting, the tab still carries the rest");
  hold = await sheetHold(page);
  assert(/resume/i.test(await holdLabel(page)), "RT-04: the sheet still shows the held clock while a set is corrected", await holdLabel(page));
  await hold.click();
  await page.waitForTimeout(1300);
  const correctResumed = secs(await clock(page));
  assert(correctResumed <= correctHeld && correctResumed >= correctHeld - 3, "RT-04: Resume continues from the held remaining time", { correctHeld, correctResumed });

  phase("N8: Start max set cannot persist a copied load without its calibration");
  async function openMaxSetSheet(candidatePage) {
    await boot(candidatePage, { restSec: 90 });
    await candidatePage.locator(`${SHELF} .saveset`).first().click();
    await candidatePage.waitForFunction(() => {
      const set = Object.values(window.__repforgeWorkoutDraft.current().exercises["seed-ex-1"].sets)
        .find(item => item.ordinal === 1);
      return set?.completion !== "pending";
    });
    await candidatePage.waitForSelector(`${SHELF} .resttip[data-tip="max-set"]`, { state: "visible", timeout: 5000 });
    await candidatePage.locator(`${SHELF} .resttip [data-maxset-guess]`).click();
    await candidatePage.waitForSelector("#maxSetSheet.is-open", { timeout: 5000 });
  }

  const atomicContext = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const atomicPage = await atomicContext.newPage();
  atomicPage.on("pageerror", (e) => errors.push(e.message));
  await openMaxSetSheet(atomicPage);
  const maxSetBefore = await atomicPage.evaluate(({ loadMetric }) => {
    const draft = window.__repforgeWorkoutDraft.current(), exercise = draft.exercises["seed-ex-1"];
    const before = Object.values(exercise.sets).find(set => set.ordinal === 1);
    const target = Object.values(exercise.sets).find(set => set.ordinal === 2);
    return { revision: draft.revision, setId: target.setId,
      sourceLoad: before.edited.metrics[loadMetric], targetLoad: target.edited.metrics?.[loadMetric] ?? null };
  }, { loadMetric: WEIGHT });
  await atomicPage.evaluate(({ exId, setId, loadMetric, sourceLoad, targetLoad }) => {
    const original = Storage.prototype.setItem;
    window.__repforgeRestoreSetItem = () => { Storage.prototype.setItem = original; };
    window.__repforgeLegacyBoundaryFaulted = false;
    Storage.prototype.setItem = function (key, value) {
      const result = original.call(this, key, value);
      if (this === window.localStorage && key === "repforge_draft_v1") {
        try {
          const persisted = JSON.parse(value), set = persisted.exercises?.[exId]?.sets?.[setId];
          if (set && !set.calibration && set.edited.metrics?.[loadMetric] === sourceLoad &&
            set.edited.metrics?.[loadMetric] !== targetLoad) {
            window.__repforgeLegacyBoundaryFaulted = true;
            window.__repforgeDraftFault = "persist-failure";
          }
        } catch {}
      }
      return result;
    };
  }, { exId: "seed-ex-1", ...maxSetBefore, loadMetric: WEIGHT });
  await atomicPage.locator("#maxSetStart").click();
  await atomicPage.waitForFunction(() => !document.querySelector("#maxSetSheet.is-open"), undefined, { timeout: 5000 });
  await atomicPage.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const atomicResult = await atomicPage.evaluate(({ setId, loadMetric, revision }) => {
    window.__repforgeRestoreSetItem();
    delete window.__repforgeDraftFault;
    const draft = window.__repforgeWorkoutDraft.current(), set = draft.exercises["seed-ex-1"].sets[setId];
    return { revisionDelta: draft.revision - revision, load: set.edited.metrics?.[loadMetric] ?? null,
      calibration: set.calibration, boundaryFaulted: window.__repforgeLegacyBoundaryFaulted };
  }, { ...maxSetBefore, loadMetric: WEIGHT });
  assert(!atomicResult.boundaryFaulted,
    "N8: the persistence fault at the old load-only boundary is never armed", atomicResult);
  assert(atomicResult.revisionDelta === 1 && atomicResult.load === maxSetBefore.sourceLoad && atomicResult.calibration,
    "N8: one command commits both the copied load and calibration", atomicResult);
  await atomicContext.close();

  phase("N8: a double tap starts only one max set");
  const doubleContext = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const doublePage = await doubleContext.newPage();
  doublePage.on("pageerror", (e) => errors.push(e.message));
  await openMaxSetSheet(doublePage);
  const doubleBefore = await doublePage.evaluate(() => window.__repforgeWorkoutDraft.current().revision);
  await holdLock(doublePage);
  await doublePage.locator("#maxSetStart").click();
  await doublePage.locator("#maxSetStart").dispatchEvent("click");
  await releaseLock(doublePage);
  await doublePage.waitForFunction(() => !document.querySelector("#maxSetSheet.is-open"), undefined, { timeout: 5000 });
  await doublePage.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const doubleResult = await doublePage.evaluate(({ revision, loadMetric }) => {
    const draft = window.__repforgeWorkoutDraft.current(), exercise = draft.exercises["seed-ex-1"];
    const set = Object.values(exercise.sets).find(item => item.ordinal === 2);
    return { revisionDelta: draft.revision - revision, load: set.edited.metrics?.[loadMetric] ?? null,
      calibration: set.calibration };
  }, { revision: doubleBefore, loadMetric: WEIGHT });
  assert(doubleResult.revisionDelta === 1 && doubleResult.calibration,
    "N8: the double tap leaves one durable max-set command", doubleResult);
  await doubleContext.close();

  await browser.close();
  assert(errors.length === 0, "no page errors", errors);
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
