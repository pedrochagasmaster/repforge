#!/usr/bin/env node
/**
 * Issue #331: commitProgramEditorProposal's rollback for a failed Build-editor
 * commit used to restore the whole previousEntryState snapshot on any
 * ok:false, discarding every edit that had already landed on entryState while
 * that write was pending, not only the one that failed.
 *
 * Two distinct failure shapes exercise persistSetupDraft's handle/raw check
 * (the setup draft's own optimistic-concurrency guard):
 *
 * 1. No foreign writer at all: every navigator.locks.request acquisition is
 *    uniformly delayed, and a fast sequence of the editor's own edits queues
 *    up behind one another. Because every write to the setup draft serializes
 *    through the same module-level write queue (queueSetupDraftWrite) and the
 *    real exclusive Web Lock, each write's handle/raw check always sees this
 *    tab's own immediately-preceding write, never a stale one — so this
 *    sequence must produce no save_conflict and keep every edit. (This is
 *    deliberately proven directly rather than assumed, since the symptom was
 *    first reported from a throwaway, uncommitted harness holding every lock
 *    acquisition open; this suite's own two-slot gate below proves the real
 *    seam still behaves as the architecture promises when nothing foreign
 *    is involved.)
 * 2. A genuine foreign writer: something else overwrites the raw bytes under
 *    the setup-draft key while a write is pending. That write's handle/raw
 *    check — and every other write already queued behind it, since none of
 *    them can ever match the foreign raw either — must fail with
 *    save_conflict. Once that happens this tab's candidate has permanently
 *    diverged from storage (matching the existing entry.save_conflict.body
 *    copy: "reload to continue from the newer saved draft"), so the fix
 *    rebases entryState onto the last state known to match what was durably
 *    saved, rather than onto each failing commit's own one-step-back
 *    snapshot — the earlier shape that could still leave memory torn from
 *    storage after several queued commits failed in sequence.
 *
 * Run with `node tools/run-tests.mjs entry --suite-id test-program-editor-setup-conflict-mjs`.
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const SETUP_DRAFT_KEY = "repforge_program_setup_draft_v1";
const EXERCISE_ID = "2aa5c6f170d880c08fcbf27e03a0e2dc";
const EXERCISE_NAME = "45° glute-biased leg press";

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

/** Every real durable write (including the setup draft's) serializes through
 * navigator.locks.request. Gating it lets a proof land its own continuation
 * at a chosen instant instead of guessing a timeout. See
 * test/catalog-metric-program-browser.mjs's installStorageLockGate (issue
 * #326), which this is adapted from. */
async function installStorageLockGate(page) {
  await page.addInitScript(() => {
    if (!navigator.locks || !navigator.locks.request) return;
    const original = navigator.locks.request.bind(navigator.locks);
    window.__repforgeGateLockCount = 0;
    window.__repforgeReleaseGatedLock = null;
    window.__repforgeLockRequestCount = 0;
    navigator.locks.request = (name, optionsOrCallback, maybeCallback) => {
      window.__repforgeLockRequestCount += 1;
      const isCallbackArg = typeof optionsOrCallback === "function";
      const callback = isCallbackArg ? optionsOrCallback : maybeCallback;
      let gated = false;
      if (window.__repforgeGateLockCount > 0) { window.__repforgeGateLockCount -= 1; gated = true; }
      const wrapped = (...args) => {
        if (!gated) return callback(...args);
        // Expose when the held critical section finishes, so a proof can
        // wait on the write's own outcome instead of a timer.
        const done = new Promise((resolve) => { window.__repforgeReleaseGatedLock = resolve; }).then(() => callback(...args));
        window.__repforgeGatedLockDone = done.then(() => true, () => true);
        return done;
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

/** Every navigator.locks.request acquisition is slow, uniformly, with no
 * selective gating and nothing foreign touching storage. */
async function installUniformLockDelay(page, delayMs) {
  await page.addInitScript((delay) => {
    if (!navigator.locks || !navigator.locks.request) return;
    const original = navigator.locks.request.bind(navigator.locks);
    window.__repforgeLockRequestCount = 0;
    navigator.locks.request = (name, optionsOrCallback, maybeCallback) => {
      window.__repforgeLockRequestCount += 1;
      const isCallbackArg = typeof optionsOrCallback === "function";
      const callback = isCallbackArg ? optionsOrCallback : maybeCallback;
      const wrapped = (...args) => new Promise((resolve) => setTimeout(resolve, delay)).then(() => callback(...args));
      return isCallbackArg ? original(name, wrapped) : original(name, optionsOrCallback, wrapped);
    };
  }, delayMs);
}

async function waitForApp(page) {
  await waitForAppBoot(page, { base: BASE });
}

/** First-run Build, with one exercise added, taken through to the editor's
 * sets/metric controls so a proof can start issuing real editor commits. */
async function reachEditorWithOneExercise(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="build"]');
  await page.fill("#entryProgramName", "Setup conflict proof");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });
  await page.locator('#onbProgramEditor [data-role="add-exercise"][data-day="Day 1"]').click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", EXERCISE_NAME);
  const option = page.locator(`#exPickList [data-pick="${EXERCISE_ID}"]`);
  await option.waitFor({ timeout: 5000 });
  await option.click();
  await page.waitForFunction(() => document.querySelectorAll('#onbProgramEditor [data-role="exercise"]').length === 1, undefined, { timeout: 10000 });
  const row = page.locator('#onbProgramEditor [data-role="exercise"]').nth(0);
  if (await row.locator('[data-role="sets-control"]').count() === 0) await row.locator('[data-role="toggle-exercise"]').click();
  await page.waitForFunction((exerciseId) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    return definition?.days?.some((day) => day.slots?.some((slot) => slot.exerciseId === exerciseId));
  }, EXERCISE_ID, { timeout: 10000 });
  return row;
}

function cycle1Of(entryState, exerciseId) {
  const slot = entryState?.result?.preview?.programDefinition?.days
    ?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === exerciseId);
  return slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1) || null;
}

/** Proof 1: no foreign writer. Every lock acquisition is uniformly slow and
 * the editor's own edits queue up fast behind one another; none of them may
 * ever see a stale handle, because every write to the setup draft (this
 * tab's own queue plus the real exclusive lock) is strictly ordered. */
async function proveNoSelfConflict(browser) {
  console.log("\nProof 1: a fast sequence of the editor's own edits under uniformly delayed locks, no foreign writer");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await installUniformLockDelay(page, 400);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const row = await reachEditorWithOneExercise(page);
  // reachEditorWithOneExercise only waits for the app-level entryState (which
  // advances synchronously, ahead of the durable write) to see the
  // newly-added exercise's canonical slot. The mounted editor's own
  // client-side document (program-editor.js's local copy, which the DOM
  // actually renders from) only adopts that same canonical slot once the
  // "add exercise" commit's own promise resolves — under this test's
  // uniform lock delay that is a real, if short, extra wait. Firing a
  // structural edit before then would fall through setExerciseField's
  // legacy, slot-less path (no canonical slot to mutate yet), which the
  // next successful commit's full-document sync then quietly overwrites —
  // a distinct race from the one this proof is about. Waiting here is a
  // genuine prerequisite, not padding.
  await page.waitForFunction((exerciseId) => {
    const doc = window.__repforgeOnboardingEditorDocument?.();
    return doc?.programMeta?.programDefinition?.days?.flatMap((d) => d.slots || []).some((s) => s.exerciseId === exerciseId);
  }, EXERCISE_ID, { timeout: 10000 });

  const plus = row.locator('[data-role="adjust"][data-field="sets"][data-delta="1"]');
  const setsValue = row.locator('[data-role="sets-value"]');
  const startingSets = Number((await setsValue.textContent()).trim());
  check(Number.isFinite(startingSets), "the exercise starts with a readable sets count", startingSets);
  // Fire several structural edits back to back. Each click's own optimistic
  // DOM update is local and near-instant (stage() applies it synchronously,
  // before ever calling the adapter), so waiting for it between clicks does
  // not wait for that click's underlying write to settle — the point is that
  // every one of those writes, each delayed ~400ms by the uniform lock
  // latency installed above, is still genuinely pending/queued when the next
  // edit fires.
  for (let i = 1; i <= 3; i++) {
    await plus.click();
    await page.waitForFunction((expected) => {
      const row0 = document.querySelectorAll('#onbProgramEditor [data-role="exercise"]')[0];
      return row0?.querySelector('[data-role="sets-value"]')?.textContent.trim() === String(expected);
    }, startingSets + i, { timeout: 10000 });
  }
  const minSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="min"]';
  await page.fill(minSelector, "8");
  await page.locator(minSelector).press("Tab");
  const maxSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="max"]';
  await page.fill(maxSelector, "12");
  await page.locator(maxSelector).press("Tab");
  const loadSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="loadKg"][data-set-index="1"][data-bound="value"]';
  await page.fill(loadSelector, "65");
  await page.locator(loadSelector).press("Tab");
  const rirSelector = '[data-role="prescription-field"][data-cycle-index="1"][data-set-index="1"][data-field="rir"]';
  await page.fill(rirSelector, "2");
  await page.locator(rirSelector).press("Tab");

  // Let every queued write (each delayed ~400ms) drain.
  await page.waitForFunction((expected) => {
    const slot = window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
      ?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === expected.exerciseId);
    const c1 = slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1);
    return c1?.sets?.length === expected.sets && c1.sets[0]?.targets?.loadKg === 65 && c1.sets[0]?.rir === 2;
  }, { exerciseId: EXERCISE_ID, sets: startingSets + 3 }, { timeout: 15000 });

  const diagnostic = await page.evaluate(() => window.__repforgeEntryPersistenceDiagnostic?.());
  const notice = await page.evaluate(() => document.querySelector('#onbBody .entry__notice[role="alert"]')?.textContent?.trim() || null);
  const lockRequests = await page.evaluate(() => window.__repforgeLockRequestCount);
  const entryState = await page.evaluate(() => window.__repforgeEntryState());
  const cycle1 = cycle1Of(entryState, EXERCISE_ID);

  check(lockRequests >= 7, "the sequence actually produced several overlapping durable writes, not just one", { lockRequests });
  check(diagnostic?.ok === true && diagnostic?.code === null,
    "no commit in the sequence ever reports a conflict (or any other failure)", diagnostic);
  check(notice === null, "no save_conflict (or other) notice appears on the editor's status surface", notice);
  check(cycle1?.sets?.length === startingSets + 3, "the sets-count edits are all kept", cycle1?.sets?.length);
  check(cycle1?.sets?.[0]?.targets?.reps?.min === 8 && cycle1?.sets?.[0]?.targets?.reps?.max === 12,
    "the rep-range edit is kept", cycle1?.sets?.[0]?.targets?.reps);
  check(cycle1?.sets?.[0]?.targets?.loadKg === 65, "the load edit is kept", cycle1?.sets?.[0]?.targets?.loadKg);
  check(cycle1?.sets?.[0]?.rir === 2, "the RIR edit is kept", cycle1?.sets?.[0]?.rir);

  const domSets = (await row.locator('[data-role="sets-value"]').textContent()).trim();
  check(domSets === String(startingSets + 3), "the editor DOM shows every sets-count edit kept, not reverted", domSets);

  await context.close();
}

/** Proof 2: a genuine foreign writer. Something else overwrites the setup
 * draft's raw bytes while one write is pending and a second edit is already
 * queued behind it. Neither commit can ever match that foreign raw, so both
 * must fail — and the candidate must land on one coherent, non-torn state
 * afterwards, not a mix of some-edits-kept/some-dropped. */
async function proveCoherentForeignConflict(browser) {
  console.log("\nProof 2: a genuine foreign write, with two edits already queued behind the failing write");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await installStorageLockGate(page);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const row = await reachEditorWithOneExercise(page);

  // Give the exercise a known-good, durably-saved baseline before the race:
  // sets=1, reps 8-12, load 65 — all committed with no gate active.
  const minus = row.locator('[data-role="adjust"][data-field="sets"][data-delta="-1"]');
  const setsValue = row.locator('[data-role="sets-value"]');
  let currentSets = Number((await setsValue.textContent()).trim());
  while (currentSets > 1) {
    await minus.click();
    const next = currentSets - 1;
    await page.waitForFunction((expected) => {
      const row0 = document.querySelectorAll('#onbProgramEditor [data-role="exercise"]')[0];
      return row0?.querySelector('[data-role="sets-value"]')?.textContent.trim() === String(expected);
    }, next, { timeout: 10000 });
    currentSets = next;
  }
  const minSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="min"]';
  await page.fill(minSelector, "8"); await page.locator(minSelector).press("Tab");
  const maxSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="reps"][data-set-index="1"][data-bound="max"]';
  await page.fill(maxSelector, "12"); await page.locator(maxSelector).press("Tab");
  const loadSelector = '[data-role="metric-target"][data-cycle-index="1"][data-semantic="loadKg"][data-set-index="1"][data-bound="value"]';
  await page.fill(loadSelector, "65"); await page.locator(loadSelector).press("Tab");
  // entryState advances synchronously the instant persistSetupDraft is
  // called, well before its durable write lands — every other wait in this
  // file deliberately uses that to drive the UI at optimistic-update speed,
  // but it is not a signal that this edit's write (or any queued ahead of
  // it) has settled. baselineRaw below, and lastPersistedEntryState in the
  // product, are only updated once the write's own critical section runs;
  // under contention that can lag entryState enough to race this proof's own
  // gate setup, which is exactly the failure this wait exists to rule out.
  // Wait on the one signal that is actually durable: the stored raw bytes
  // themselves, decoded the same way persistSetupDraft's own queuedState is
  // shaped. Every write before this one in the FIFO queue (the decrements,
  // min, max) is necessarily already settled too, since this one could not
  // have reached storage otherwise.
  await page.waitForFunction((params) => {
    let envelope;
    try { envelope = JSON.parse(localStorage.getItem(params.key) || ""); } catch { return false; }
    const slot = envelope?.state?.result?.preview?.programDefinition?.days
      ?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === params.exerciseId);
    const c1 = slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1);
    return c1?.sets?.length === 1 && c1.sets[0]?.targets?.loadKg === 65;
  }, { key: SETUP_DRAFT_KEY, exerciseId: EXERCISE_ID }, { timeout: 10000 });
  const baselineRaw = await page.evaluate((key) => localStorage.getItem(key), SETUP_DRAFT_KEY);
  check(typeof baselineRaw === "string" && baselineRaw.length > 0, "a known-good baseline is durably saved before the race", { length: baselineRaw?.length });

  // Gate the next two durable writes: edit A (sets 1 -> 2) and edit B
  // (load 65 -> 70), queued one behind the other.
  await armStorageLockGate(page, 2);
  const plus = row.locator('[data-role="adjust"][data-field="sets"][data-delta="1"]');
  await plus.click();
  await page.waitForFunction(() => {
    const row0 = document.querySelectorAll('#onbProgramEditor [data-role="exercise"]')[0];
    return row0?.querySelector('[data-role="sets-value"]')?.textContent.trim() === "2";
  }, undefined, { timeout: 10000 });
  await page.waitForFunction(() => window.__repforgeGateLockCount === 1, undefined, { timeout: 10000 });
  await page.fill(loadSelector, "70");
  await page.locator(loadSelector).press("Tab");
  await page.waitForFunction((exerciseId) => {
    const slot = window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((candidate) => candidate.exerciseId === exerciseId);
    return slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1)?.sets?.[0]?.targets?.loadKg === 70;
  }, EXERCISE_ID, { timeout: 10000 });

  // A genuine foreign writer: a valid envelope (so it stays a resumable
  // setup draft), with the same state this tab last durably saved, but a
  // different owner and the next revision — exactly what another tab's own
  // successful write would leave behind. The handle/raw check works on raw
  // bytes, so this alone is enough to make both A and B's checks fail,
  // without touching any production function.
  const foreignRaw = await page.evaluate((raw) => {
    const envelope = JSON.parse(raw);
    return JSON.stringify({ ...envelope, revision: envelope.revision + 1, ownerId: `${envelope.ownerId}-foreign` });
  }, baselineRaw);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SETUP_DRAFT_KEY, raw: foreignRaw });

  // Release A: its handle/raw check must now fail against the foreign raw.
  await releaseStorageLockGate(page);
  // B is queued right behind A and gets gated on its own turn.
  await page.waitForFunction(() => typeof window.__repforgeReleaseGatedLock === "function", undefined, { timeout: 10000 });

  const afterA = await page.evaluate(() => window.__repforgeEntryPersistenceDiagnostic?.());
  check(afterA?.ok === false && afterA?.code === "setup-draft-conflict",
    "edit A's write fails with a real save_conflict against the foreign raw", afterA);
  const noticeAfterA = await page.evaluate(() => document.querySelector('#onbBody .entry__notice[role="alert"]')?.textContent?.trim() || null);
  check(!!noticeAfterA, "the failure is already shown on the editor's notice surface before B even runs", noticeAfterA);
  const stateAfterA = await page.evaluate((exerciseId) => {
    const slot = window.__repforgeEntryState()?.result?.preview?.programDefinition?.days
      ?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === exerciseId);
    const c1 = slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1);
    return { sets: c1?.sets?.length ?? null, loadKg: c1?.sets?.[0]?.targets?.loadKg ?? null };
  }, EXERCISE_ID);
  check(stateAfterA.sets === 1 && stateAfterA.loadKg === 65,
    "A's own failure already rebases entryState onto the last durably-saved state, discarding both A's and the already-queued B's unpersisted changes",
    stateAfterA);

  // Release B: it must fail the same way (storage still holds the foreign
  // raw — nothing fixed it), and must not drift state any further.
  await page.evaluate(() => { window.__repforgeReleaseGatedLock(); window.__repforgeReleaseGatedLock = null; });
  await page.waitForFunction(() => window.__repforgeGateLockCount === 0, undefined, { timeout: 10000 });
  // Wait for B's own critical section to finish, then one frame so the
  // commit's continuation after its awaited write has run.
  await page.evaluate(async () => {
    await window.__repforgeGatedLockDone;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const afterB = await page.evaluate(() => window.__repforgeEntryPersistenceDiagnostic?.());
  check(afterB?.ok === false && afterB?.code === "setup-draft-conflict",
    "edit B's write also fails with a real save_conflict (the foreign raw was never corrected)", afterB);
  const stateAfterB = await page.evaluate((exerciseId) => {
    const slot = window.__repforgeEntryState()?.result?.preview?.programDefinition?.days
      ?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === exerciseId);
    const c1 = slot?.prescriptionsByCycle?.find((c) => c.cycleIndex === 1);
    return { sets: c1?.sets?.length ?? null, loadKg: c1?.sets?.[0]?.targets?.loadKg ?? null };
  }, EXERCISE_ID);
  check(stateAfterB.sets === 1 && stateAfterB.loadKg === 65,
    "after both A and B have failed, entryState is still the same coherent, last-durably-saved state — no torn mix of kept/dropped edits",
    stateAfterB);
  const noticeAfterB = await page.evaluate(() => document.querySelector('#onbBody .entry__notice[role="alert"]')?.textContent?.trim() || null);
  check(!!noticeAfterB, "the failure is still shown on the editor's notice surface after both settle", noticeAfterB);

  // The editor's own document (program-editor.js's local copy, which the DOM
  // actually renders from) must also be back in sync, not still showing A's
  // or B's doomed edits.
  const domSets = (await row.locator('[data-role="sets-value"]').textContent()).trim();
  const domLoad = await row.locator(loadSelector).inputValue();
  check(domSets === "1", "the editor DOM shows the rebased sets count, not A's doomed edit", domSets);
  check(domLoad === "65", "the editor DOM shows the rebased load target, not B's doomed edit", domLoad);

  await context.close();
}

async function main() {
  console.log("Program editor setup-draft conflict semantics (issue #331)");
  console.log(`Target: ${BASE}\n`);
  const browser = await launchChromium();
  try {
    await proveNoSelfConflict(browser);
    await proveCoherentForeignConflict(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}
main().catch((error) => { console.error(error); process.exit(1); });
