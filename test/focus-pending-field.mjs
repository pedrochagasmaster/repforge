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
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

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

const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

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

/** A fresh device with the seed program and one earlier session of the first exercise at 50 kg. */
async function boot(page, { rirMode = "numeric", restSec = 90, sets = 2, fontScale = 1 } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    if (window.stopRest) window.stopRest();
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, DRAFT);
  const date = isoDaysAgo(7);
  await persist(page, `
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: ${JSON.stringify(rirMode)}, restSec: ${restSec} };
    s.program = ${JSON.stringify(seedProgram().map((e) => ({ ...e, sets })))};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = ${JSON.stringify(Array.from({ length: sets }, (_, n) => ({
      session: `${date}_Day 1_seed`, date, day: "Day 1", name: "Hack squat", exerciseId: "seed-ex-1", set: n + 1,
      load: 50, reps: 6, rir: 2, notes: "", created: `${date}T12:00:00.000Z`, primary: "Quads", secondary: "Glutes,Adductors",
    })))};`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  if (fontScale !== 1) await page.evaluate((s) => { document.documentElement.style.fontSize = `${s * 100}%`; }, fontScale);
  await page.evaluate(async () => {
    await window.__repforgeEnterWorkout({});
    window.__repforgeFocus.to(0);
  });
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(150);
}

const SHELF = "#workout .exercise.is-current .focus-shelf";
const field = (id) => `${SHELF} [data-shelf-field="${id}"]`;
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
  page.evaluate(({ id, n }) => {
    const card = document.querySelector("#workout .exercise.is-current");
    const shelf = card.querySelector(".focus-shelf");
    const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const input = shelf.querySelector(`.shelf__input[data-k$="_${n}_${id === "effort" ? "rir" : id}"]`);
    const fieldEl = shelf.querySelector(`.shelf__field[data-field="${id === "effort" ? "rir" : id}"]`);
    const open = card.querySelector(".ledgerline--open");
    const col = id === "effort" ? "rir" : id;
    const target = window.__repforgeWorkoutDraft.target(`${card.dataset.ex}_${n}`);
    const set = window.__repforgeWorkoutDraft.current().exercises[target.exerciseInstanceId].sets[target.setId];
    return {
      input: input ? input.value : null,
      label: text(fieldEl?.querySelector(".shelf__val")),
      ledger: text(open?.querySelector(`[data-lv="${col}"]`)),
      draft: set.edited[id] ?? null,
      effortAttr: fieldEl?.querySelector("[data-effspin]")?.dataset.e ?? null,
    };
  }, { id, n });

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
  await boot(page, { sets: 2 });
  await page.locator(field("load")).click();
  const start = num((await readField(page, "load")).input);
  assert(start === 50, "RT-03: the first set is suggested at 50", start);
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
  await page.waitForTimeout(250);
  // Set 2 as suggested, then save the session through the real Finish action.
  await page.locator(".focus-shelf .saveset").first().click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const finished = await finishEarly(page);
  assert(finished && finished.status !== "error", "RT-03: the session saves through the real Finish action", finished);
  const logRows = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter((r) => r.exerciseId === "seed-ex-1" && !String(r.session).endsWith("_seed")), KEY);
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
  await page.locator(field("load")).click();
  await page.locator(field("load")).click(); // second tap opens the input
  await holdLock(page);
  await page.locator(`${SHELF} .shelf__input[data-k$="_1_load"]`).fill("57.5");
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
  await page.locator(`${SHELF} [data-effstep] >> nth=0`).click();
  await page.locator(field("load")).click(); // rebuild
  const effortWaiting = await readField(page, "effort");
  await page.locator(field("rir")).click();
  await page.locator(`${SHELF} [data-effstep] >> nth=1`).click(); // second step reads the rebuilt control
  await releaseLock(page);
  const effort1 = await readField(page, "effort");
  assert(effort1.label && effort1.label === effort1.ledger && String(effort1.draft).toLowerCase() === effort1.effortAttr,
    "RT-03: effort label, ledger, control and acknowledged draft agree after two steps across rebuilds", { effort0, effortWaiting, effort1 });
  assert(effortWaiting.label === effortWaiting.ledger && effortWaiting.label !== effort0.label && effort1.label !== effortWaiting.label,
    "RT-03: each step moved the word, and the rebuilt shelf kept the first one", { effort0, effortWaiting, effort1 });

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
    await boot(page, { sets: 3, restSec: 0 });
    await page.locator(".focus-shelf .saveset").first().click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
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
      return ex.setOrder.map((id) => ({ ord: ex.sets[id].ordinal, rir: ex.sets[id].edited.rir ?? null, load: ex.sets[id].edited.load ?? null, suggested: ex.sets[id].programmed.suggestedLoad ?? null, reps: ex.sets[id].programmed.suggestedReps ?? null }));
    });
  }
  assert(JSON.stringify(corrected[true]) === JSON.stringify(corrected[false]),
    "RT-03: correcting a logged set through two pad taps across a rebuild ends on the same draft as without one", corrected);

  // ---- h: failed and stale writes --------------------------------------------
  phase("RT-03: a failed write leaves the banner in charge, and its retry agrees everywhere");
  await boot(page);
  await page.locator(field("load")).click();
  await page.evaluate(() => { window.__repforgeDraftFault = "persist-failure"; });
  await page.locator(pad(1)).click();
  await page.locator(field("rir")).click(); // rebuild after the failure
  await page.waitForSelector("#draftRecovery:not(.hidden)", { timeout: 5000 });
  const failed = await readField(page, "load");
  assert(num(failed.draft) === 50 && num(failed.label) === num(failed.ledger) && num(failed.ledger) === 50,
    "RT-03: after a failed write the rebuilt shelf and ledger show what the draft holds, and the banner carries the typed value", failed);
  assert((await page.locator("#draftRecoveryPending").textContent()).includes("52.5"), "RT-03: the recovery banner names the pending value");
  await page.evaluate(() => { delete window.__repforgeDraftFault; });
  await page.locator("#draftRecoveryRetry").click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForTimeout(100);
  agree("RT-03 after Retry", await readField(page, "load"), 52.5);

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
  const clock = (p) => p.evaluate(() => document.querySelector("#woRest .wo-rest__time")?.textContent?.trim());
  const secs = (s) => { const m = /^(\d+):(\d\d)$/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : NaN; };
  async function startRestByLogging(p) {
    await p.locator(".focus-shelf .saveset").first().click();
    await p.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await p.waitForFunction(() => document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
    await p.waitForTimeout(200);
  }
  async function sheetHold(p) {
    await p.locator("#woRest").click();
    await p.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    return p.locator("#restHold");
  }

  phase("RT-04: Pause/Resume stays reachable after a field tap replaced the rest pads");
  await boot(page, { restSec: 90, sets: 3 });
  await startRestByLogging(page);
  await page.locator("#workout .exercise.is-current .restpad--toggle").click();
  const heldAt = secs(await clock(page));
  await page.locator(field("load")).click(); // brings the field pads back for the rest of this rest
  await page.waitForFunction(() => !document.querySelector("#workout .motion-fade-out"), undefined, { timeout: 3000 });
  assert(!(await page.locator("#workout .exercise.is-current .restpad--toggle").count()), "RT-04: the inline Pause/Resume pad is gone after the field tap");
  let hold = await sheetHold(page);
  assert((await hold.count()) === 1 && (await hold.isVisible()) && (await hold.isEnabled()), "RT-04: the presets sheet offers a Pause/Resume control", await hold.count());
  assert(/resume/i.test(await hold.textContent()), "RT-04: it reads Resume while the clock is held", await hold.textContent());
  await page.waitForTimeout(1300);
  assert(secs(await clock(page)) === heldAt, "RT-04: the held clock did not move", { heldAt, now: await clock(page) });
  await hold.click();
  assert(/pause/i.test(await hold.textContent()), "RT-04: after Resume the control offers Pause");
  await page.waitForTimeout(1300);
  const resumedAt = secs(await clock(page));
  assert(resumedAt <= heldAt && resumedAt >= heldAt - 3, "RT-04: Resume continues from the remaining time that was held", { heldAt, resumedAt });
  await hold.click();
  const reheld = secs(await clock(page));
  await page.waitForTimeout(1200);
  assert(secs(await clock(page)) === reheld, "RT-04: the sheet can pause again", { reheld });
  await page.locator("#restStop").click();
  await page.waitForFunction(() => !document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
  await boot(page, { restSec: 90, sets: 2 });
  await page.evaluate(() => window.openRestSheet());
  await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
  assert(await page.locator("#restHold").isDisabled(), "RT-04: with no rest running the control waits, like Reset and Stop");
  await page.locator("#restSheetClose").click();
  await page.waitForSelector("#restSheet", { state: "hidden", timeout: 5000 });

  phase("RT-04: at 200% text, start, pause, edit a field, resume the same remaining time");
  await boot(page, { restSec: 90, sets: 3, fontScale: 2 });
  assert(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) > 16.1), "RT-04: the root text is scaled");
  await startRestByLogging(page);
  assert(!(await page.locator("#workout .exercise.is-current .restpad--toggle").count()), "RT-04: at 200% the field pads stay and the inline rest pad is not shown");
  hold = await sheetHold(page);
  await hold.click();
  const largeHeld = secs(await clock(page));
  assert(/resume/i.test(await hold.textContent()), "RT-04: the sheet pauses the clock at 200%");
  const box = await hold.boundingBox();
  const sheetBox = await page.locator("#restSheet").boundingBox();
  assert(box && box.x >= sheetBox.x - 1 && box.x + box.width <= sheetBox.x + sheetBox.width + 1 && box.width > 40 && box.height >= 40,
    "RT-04: the control fits the sheet and meets the target size at 200%", { box, sheetBox });
  await page.locator("#restSheetClose").click();
  await page.waitForSelector("#restSheet", { state: "hidden", timeout: 5000 });
  await page.locator(field("load")).click();
  await page.locator(pad(1)).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.waitForTimeout(1200);
  assert(secs(await clock(page)) === largeHeld, "RT-04: editing a field does not move the held clock", { largeHeld, now: await clock(page) });
  hold = await sheetHold(page);
  await hold.click();
  await page.waitForTimeout(1300);
  const largeResumed = secs(await clock(page));
  assert(largeResumed <= largeHeld && largeResumed >= largeHeld - 3, "RT-04: Resume continues from the held remaining time at 200%", { largeHeld, largeResumed });

  phase("RT-04: while correcting a logged set");
  await boot(page, { restSec: 90, sets: 3 });
  await startRestByLogging(page);
  await page.locator("#workout .exercise.is-current .restpad--toggle").click();
  const correctHeld = secs(await clock(page));
  await page.locator(`#workout .exercise.is-current .ledgerline[data-editn="1"]`).click();
  await page.waitForSelector(`${SHELF}.is-editing`);
  await page.waitForFunction(() => !document.querySelector("#workout .motion-fade-out"), undefined, { timeout: 3000 });
  assert(!(await page.locator("#workout .exercise.is-current .restpad--toggle").count()), "RT-04: while correcting, the rest pads are not in the pad row");
  hold = await sheetHold(page);
  assert(/resume/i.test(await hold.textContent()), "RT-04: the sheet still shows the held clock while a set is corrected", await hold.textContent());
  await hold.click();
  await page.waitForTimeout(1300);
  const correctResumed = secs(await clock(page));
  assert(correctResumed <= correctHeld && correctResumed >= correctHeld - 3, "RT-04: Resume continues from the held remaining time", { correctHeld, correctResumed });

  await browser.close();
  assert(errors.length === 0, "no page errors", errors);
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
