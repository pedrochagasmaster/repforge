/**
 * Drive the non-onboarding surfaces.
 *
 * Every scenario is self-contained: it starts from the seeded catalog program
 * and navigates to its own subject. The previous tool walked one long-lived
 * page through all 35 screens in order, so a single broken step silently
 * poisoned every frame after it.
 */
import { catalogState, emptyEntryState, localeState } from "./fixtures.mjs";
import { CAPTURE_NOW, dismissChrome, LOG_DRAFT, sleep } from "./session.mjs";

function isoDaysAgo(n) {
  const date = new Date(Date.parse(CAPTURE_NOW));
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

export function appState(key, lang) {
  if (key === "today/no-program" || key === "program/no-program") {
    return emptyEntryState(lang);
  }
  if (key.startsWith("progress/sibling-") || key === "progress/volume-reduction-preview" ||
      ["progress/recovery-ineligible","progress/recovery-questions","progress/recovery-preview","progress/recovery-active","progress/recovery-reassessment"].includes(key)) {
    return emptyEntryState(lang);
  }
  const state = catalogState();
  if (key.startsWith("session/summary-")) {
    const dayExercises = state.program.filter((exercise) => exercise.day === "Day 1");
    const loads = dayExercises.map((_, index) => 80 + index * 5);
    const priorLoads = key === "session/summary-declined"
      ? loads.map((load) => load + 10)
      : key === "session/summary-mixed"
        ? loads.map((load, index) => index % 2 ? load + 10 : load)
        : loads;
    const priorDate = isoDaysAgo(1);
    state.log.push(...dayExercises.map((exercise, index) => ({
      session: "summary-" + key.slice("session/summary-".length) + "-prior",
      date: priorDate,
      day: exercise.day,
      name: exercise.name,
      exerciseId: exercise.id,
      set: 1,
      load: priorLoads[index],
      reps: key === "session/summary-declined" || (key === "session/summary-mixed" && index % 2)
        ? 8
        : 6,
      rir: 1,
      work: true,
      notes: "",
      created: priorDate + "T12:00:00.000Z",
      primary: exercise.primary,
      secondary: exercise.secondary,
      performedLibraryId: exercise.libraryId || undefined,
    })));
  }
  if (key === "program/readiness") {
    const exercise = state.program[0];
    const date = isoDaysAgo(2);
    state.log = Array.from({ length: exercise.sets }, (_, index) => ({
      session: "program-readiness",
      date,
      day: exercise.day,
      name: exercise.name,
      exerciseId: exercise.id,
      set: index + 1,
      load: 100,
      reps: 8,
      rir: 1,
      work: true,
      notes: "",
      created: `${date}T12:0${index}:00.000Z`,
      primary: exercise.primary,
      secondary: exercise.secondary,
      performedLibraryId: exercise.libraryId || undefined,
    }));
  }
  if (key.startsWith("program/share-")) {
    const libraryIds = ["sq_bb", "lc_mc", "pr_bb", "rw1_db", "dl_cb", "pd_bw", "dl_bb", "sp_cb", "cu_bb", "le_mc", "ci_mc", "tr_cb"];
    state.program.forEach((exercise, index) => { exercise.libraryId = libraryIds[index] || "sq_bb"; });
    if (key === "program/share-one-blocker" || key === "program/share-repair-return") {
      state.program[0].libraryId = "";
    }
  }
  if (key === "progress/overview-baseline" || key === "progress/review-insufficient") {
    const seen = new Set();
    state.log = state.log.filter((row) => {
      const id = row.exerciseId || row.name;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if ((key.startsWith("progress/review-") && key !== "progress/review-active") || key.startsWith("progress/schedule-") ||
      key.startsWith("progress/sibling-") || key.startsWith("progress/guided-") ||
      key.startsWith("progress/volume-reduction") || key.startsWith("progress/recovery-")) {
    state.programMeta.mesocycleStatus = "completed";
  }
  // The editor reference is intentionally a compact two-exercise day, matching
  // the canonical installed-editor mockup. Other catalog surfaces keep the
  // richer fixture so their progress and volume evidence remains meaningful.
  if (key === "program/progression-editor") {
    state.program = state.program.filter((exercise) =>
      exercise.day !== "Day 1" || exercise.id === "ex-sq" || exercise.id === "ex-curl");
  }
  return localeState(state, lang);
}

const view = async (page, name) => {
  await page.click(`nav [data-view="${name}"]`);
  await sleep(page, 500);
};

async function enterWorkout(page, options = {}) {
  await page.evaluate((opts) => window.__repforgeEnterWorkout(opts), options);
  await sleep(page, 600);
}

async function focusMode(page) { await enterWorkout(page); }

async function openTransferState(page, state) {
  await page.evaluate((name) => window.__repforgeUi.openInstallTransferState(name), state);
  await page.waitForSelector(`#iosInstallSheet[data-transfer-state="${state}"].is-open`, { timeout: 10000 });
  await sleep(page, 300);
}

/** Fill the current focus card and save the set, which starts the rest timer. */
async function logCurrentSet(page) {
  await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current")
      || document.querySelector("#workout .exercise");
    card?.querySelectorAll("input").forEach((el) => {
      const key = el.dataset.k || "";
      if (key.endsWith("_load")) el.value = "100";
      else if (key.endsWith("_reps")) el.value = "6";
      else if (key.endsWith("_rir")) el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    card?.querySelector(".saveset, .focus-well .btn--cta")?.click();
  });
  await sleep(page, 600);
}

async function saveWholeSession(page) {
  await enterWorkout(page, { day: "Day 1" });
  await page.evaluate(() => {
    const set = (suffix, value) => {
      document.querySelectorAll(`#workout [data-k$="${suffix}"]`).forEach((el, index) => {
        el.value = typeof value === "function" ? value(index) : value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    set("_1_load", (i) => String(80 + i * 5));
    set("_1_reps", "6");
    set("_1_rir", "1");
  });
  // The fixture fills one set per exercise, so the normal finish boundary
  // correctly rejects it as incomplete. Use the same visible confirmation
  // path a lifter must use for an intentional partial session.
  await page.click("#sessionSheetBtn");
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 15000 });
  await page.click("#sessionEarlyFinish");
  await page.click("#sessionEarlyConfirm");
  await page.waitForFunction(() => {
    const el = document.querySelector("#sessionSummary");
    return el && !el.hidden && !el.classList.contains("hidden");
  }, undefined, { timeout: 15000 });
  await sleep(page, 900);
}

async function saveMixedSummarySession(page) {
  await enterWorkout(page, { day: "Day 1" });
  for (const exerciseIndex of [0, 1]) {
    if (exerciseIndex > 0) {
      await page.click("#sessionSheetBtn");
      await page.waitForSelector("#sessionSheet.is-open", { timeout: 15000 });
      const target = page.locator("[data-session-map-jump]").nth(exerciseIndex);
      const exerciseId = await target.getAttribute("data-session-map-jump");
      await target.click();
      await page.waitForSelector("#sessionSheet.is-open", { state: "hidden", timeout: 15000 });
      await page.waitForFunction(
        (id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
        exerciseId,
        { timeout: 15000 },
      );
    }
    await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      card?.querySelectorAll("input").forEach((el) => {
        const key = el.dataset.k || "";
        if (key.endsWith("_load")) el.value = "100";
        else if (key.endsWith("_reps")) el.value = "6";
        else if (key.endsWith("_rir")) el.value = "1";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      card?.querySelector(".saveset")?.click();
    });
    await sleep(page, 700);
  }
  await page.click("#sessionSheetBtn");
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 15000 });
  await page.click("#sessionEarlyFinish");
  await page.click("#sessionEarlyConfirm");
  await page.waitForFunction(() => {
    const el = document.querySelector("#sessionSummary");
    return el && !el.hidden && !el.classList.contains("hidden");
  }, undefined, { timeout: 15000 });
  await sleep(page, 900);
}

async function openLibrary(page) {
  await page.evaluate(() => window.__repforgeOpenLibrary({}));
  await sleep(page, 600);
}

async function openProgram(page) {
  await view(page, "program");
}

async function openHistoryEditor(page) {
  await view(page, "history");
  await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
  await page.locator("#sessions .session__open").first().click();
  await page.waitForSelector(".session--read", { timeout: 20000 });
  await page.locator("[data-history-edit]").click();
  await page.waitForSelector(".session--edit", { timeout: 20000 });
}

async function openShare(page) {
  await openProgram(page);
  await page.click("#shareProgramSetup");
  await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 20000 });
}

async function progressSegment(page, segment) {
  await view(page, "stats");
  const primary = segment === "overview" || segment === "review";
  await page.click(`${primary ? "#statsSeg" : "#statsEvidence"} [data-seg="${segment}"]`);
  await sleep(page, 500);
}

async function completeCompiledProgram(page, { days = 4, minutes = 90 } = {}) {
  await page.evaluate(async ({ days, minutes }) => {
    const services = window.__repforgeOnboarding.services();
    const compiled = services.compile({ mode: "recommend", answers: {
      desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most",
      daysPerWeek: days, sessionMinutes: minutes, preferredRestSeconds: 90,
      environment: { kind: "commercial_gym" }, primaryMuscles: [], deEmphasizedMuscles: [],
      ignoredMuscles: [], priorityMovements: [], mustHaveExercises: [], exerciseConstraints: [],
    }, versions: services.currentVersions() });
    if (!compiled.ok) throw new Error(`catalog compiler failed: ${compiled.code}`);
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program, name: "Catalog transition program",
      answers: { goal: "strength_hypertrophy", experience: "intermediate", sessionLength: String(minutes), daysPerWeek: days }, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure, compilerContext: compiled.compilerContext,
    });
    if (!(finalized?.localOk || finalized?.idbOk)) throw new Error("catalog finalize failed");
    const state = JSON.parse(localStorage.getItem("repforge_v1"));
    state.programMeta.mesocycleStatus = "completed";
    // The production shell keeps the detailed Progress panels out of the
    // first-run empty state. Give transition frames one real session so they
    // exercise the completed-block Review surface without pretending that the
    // empty-device shell has evidence. Recovery scenarios replace this with
    // their own dated rows below.
    state.log = state.program.slice(0, 2).map((exercise, index) => ({
      session: "catalog-transition-session", date: state.programMeta.started,
      day: exercise.day, name: exercise.name, exerciseId: exercise.id, set: 1,
      load: 60 + index * 5, reps: 8, rir: 2, work: true,
      blockId: state.programMeta.blockId || undefined,
      created: state.programMeta.started + "T12:00:00.000Z",
      primary: exercise.primary, secondary: exercise.secondary,
      performedLibraryId: exercise.libraryId || undefined,
    }));
    const committed = await window.__repforgeCommitProposedState(state);
    if (!(committed?.localOk || committed?.idbOk)) throw new Error("catalog completion failed");
    await window.__repforgeStorage.flush();
  }, { days, minutes });
  // The direct commit seam updates durable state and the in-memory owner,
  // but the capture is proving the post-boot surface. Reload so the
  // transition frames cannot depend on which view happened to be active
  // while the fixture was assembled.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await sleep(page, 300);
}

async function openCompletedReview(page) {
  await progressSegment(page, "review");
}

async function openScheduleDiagnosis(page) {
  await openCompletedReview(page);
  await page.click('[data-review-action="schedule-repair"]');
  await sleep(page, 300);
}

async function openSiblingPreview(page, kind) {
  await completeCompiledProgram(page);
  await openScheduleDiagnosis(page);
  if (kind === "sessions_too_long") await page.click('[data-diag="sessions_too_long"]');
  await page.fill("[data-diag-target]", kind === "sessions_too_long" ? "60" : "3");
  await page.click("[data-diag-continue]");
  await page.waitForSelector("[data-preview-confirm]", { timeout: 20000 });
  await sleep(page, 400);
}

async function openRecoveryPreview(page) {
  await completeCompiledProgram(page);
  await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem("repforge_v1"));
    const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    state.programMeta.started = start;
    state.programMeta.mesocycleStatus = "completed";
    state.log = [];
    const blockId = state.programMeta.blockId || undefined;
    for (const [index, exercise] of state.program.entries()) for (const [offset, load] of [[7, 50 + index], [1, 50 + index]]) {
      const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
      state.log.push({ session: `recovery-${offset}-${index}`, date, day: exercise.day, name: exercise.name,
        exerciseId: exercise.id, set: 1, load, reps: 8, rir: 2, work: true,
        blockId,
        primary: exercise.primary, secondary: exercise.secondary,
        performedLibraryId: exercise.libraryId || undefined,
        created: `${date}T12:00:00.000Z` });
    }
    // The completed-program seed contributes one ordinary exposure. Add a
    // current, lower-rep exposure so the real paired-session comparison
    // produces maintained/declined pattern evidence for the recovery gate.
    const currentDate = new Date(Date.now()).toISOString().slice(0, 10);
    for (const [index, exercise] of state.program.entries()) {
      state.log.push({
        session: "recovery-current-" + index, date: currentDate, day: exercise.day,
        name: exercise.name, exerciseId: exercise.id, set: 1, load: 40,
        reps: 6, rir: 2, work: true, primary: exercise.primary,
        blockId,
        secondary: exercise.secondary, performedLibraryId: exercise.libraryId || undefined,
        created: currentDate + "T13:00:00.000Z",
      });
    }
    const committed = await window.__repforgeCommitProposedState(state);
    if (!(committed?.localOk || committed?.idbOk)) throw new Error("catalog evidence commit failed");
    await window.__repforgeStorage.flush();
  });
  await openCompletedReview(page);
  await page.click('[data-review-action="recovery-week"]');
}

async function recoveryPreview(page) {
  await openRecoveryPreview(page);
  await page.click('[data-recovery-answer="Yes"]');
  await page.waitForSelector("[data-preview-confirm]", { timeout: 20000 });
}

async function confirmRecovery(page) {
  await recoveryPreview(page);
  await page.click("[data-preview-confirm]");
  await page.waitForSelector(".review__staged", { timeout: 20000 });
  // The commit toast is written through two animation frames so repeated
  // captures do not announce the same message without a DOM change. Wait for
  // that final text before closing the staged flow; otherwise a busy runner
  // can photograph the toast shell and an intermediate review layout.
  const waitForRecoveryToast = () => page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return toast && !toast.classList.contains("hidden") && toast.textContent.trim();
  }, undefined, { timeout: 5000 });
  await waitForRecoveryToast();
  await page.click("[data-flow-cancel]");
  await waitForRecoveryToast();
  await page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return !toast || toast.classList.contains("hidden");
  }, undefined, { timeout: 5000 });
  await sleep(page, 400);
}

async function openSettings(page, anchor) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await sleep(page, 500);
  if (!anchor) return;
  await page.evaluate((sel) => {
    document.querySelector(sel)?.closest("label, .settings-row, .settings-group")
      ?.scrollIntoView({ block: "center" });
  }, anchor);
  await sleep(page, 250);
}

async function resetSheetScroll(page, selector) {
  await page.locator(selector).evaluate((element) => { element.scrollTop = 0; });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function createInUseCustomExercise(page) {
  const result = await page.evaluate(async () => {
    const created = await window.__repforgeSaveCustomExercise({
      name: "Paused cable row",
      equipment: ["machine"],
      primary: "Mid/upper back",
      secondary: "Biceps",
      notes: "Seat 4, handles at chest height",
    });
    if (created?.result?.committed !== true || created?.result?.settled !== true || !created.entry?.id)
      throw new Error("The archive evidence custom definition did not settle");
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = proposal.program?.[0];
    if (!row) throw new Error("The archive evidence fixture has no program row");
    row.libraryId = created.entry.id;
    row.movementId = `library:${created.entry.id}`;
    row.name = created.entry.name;
    row.primary = created.entry.primary;
    row.secondary = created.entry.secondary;
    const linked = await window.__repforgeCommitProposedState(proposal);
    if (linked?.committed !== true || linked?.settled !== true)
      throw new Error("The archive evidence program reference did not settle");
    return created.entry.id;
  });
  await page.evaluate(id => window.__repforgeEditCustom(id), result);
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
  return result;
}

export const APP_SCENARIOS = {
  "today/no-program": async (page) => { await dismissChrome(page); await sleep(page, 300); },
  "today/ready": async (page) => { await dismissChrome(page); await sleep(page, 300); },
  "today/day-picker": async (page) => {
    await page.click("#chooseAnotherDay");
    await page.waitForSelector("#dayPickSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "today/done": async (page) => {
    await saveWholeSession(page);
    await page.click("#sumDone");
    await sleep(page, 500);
    await page.evaluate(() => {
      document.querySelector('nav [data-view="log"]')?.click();
      if (document.body.classList.contains("is-settings")) document.querySelector("#settingsBack")?.click();
    });
    await sleep(page, 600);
  },

  "workout/focus": focusMode,
  "today/preview": async page => { await page.click("#previewSession"); await page.waitForSelector("#previewSessionSheet.is-open"); },
  "workout/session": async page => { await focusMode(page); await page.click("#sessionSheetBtn"); await resetSheetScroll(page, ".session-sheet__body"); },
  "workout/early-finish": async page => { await focusMode(page); await logCurrentSet(page); await page.click("#sessionSheetBtn"); await page.click("#sessionEarlyFinish"); await resetSheetScroll(page, ".session-sheet__body"); },
  "workout/exercise-actions": async page => { await focusMode(page); await page.locator("#workout .exercise.is-current [data-exactions-open]").click(); await resetSheetScroll(page, ".exactions-sheet__body"); },
  "workout/skipped-actions": async page => {
    await focusMode(page);
    const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await page.locator("#exActionSkipBtn").click();
    await page.locator("#exActionsSheet").waitFor({state:"hidden"});
    await page.locator("#sessionSheetBtn").click();
    await page.locator(`[data-session-map-jump="${id}"]`).click();
    await page.locator("#exActionsSheet.is-open").waitFor();
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/substituted-actions": async page => {
    await focusMode(page);
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await page.locator("#exActionSubstBtn").click();
    await page.locator("#exPickList .pickrow").first().click();
    await page.locator("#exPickSheet").waitFor({state:"hidden"});
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/warmup-actions": async page => { await focusMode(page); await page.locator("#workout .exercise.is-current [data-exactions-open]").click(); await page.locator("#exActionsWarmupList [data-warm-toggle-set]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); await resetSheetScroll(page, ".exactions-sheet__body"); },
  "workout/reorder": async page => {
    await focusMode(page);
    await page.click("#sessionSheetBtn");
    const before = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const button = document.querySelector("[data-session-reorder-down]");
      const exerciseId = button?.dataset.sessionReorderDown;
      return {
        exerciseId,
        beforeRevision: draft?.revision ?? -1,
        expectedIndex: exerciseId ? (draft?.exerciseOrder || []).indexOf(exerciseId) + 1 : -1,
      };
    });
    await page.locator("[data-session-reorder-down]").first().click();
    await page.waitForFunction(({ exerciseId, beforeRevision, expectedIndex }) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      const active = document.activeElement;
      const isMovingExercise = active?.dataset?.sessionReorderUp === exerciseId
        || active?.dataset?.sessionReorderDown === exerciseId;
      return exerciseId && draft?.revision > beforeRevision
        && draft.exerciseOrder?.[expectedIndex] === exerciseId
        && isMovingExercise && !active.disabled;
    }, before, { timeout: 15000 });
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    // Prove the production announcement was emitted, then let its ordinary
    // lifetime finish before the frame is captured. Otherwise the transient
    // toast races the catalog settle pass and makes the same screen alternate
    // between a toast-covered and uncovered frame.
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden") && toast.textContent.trim();
    }, undefined, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 15000 });
    await resetSheetScroll(page, ".session-sheet__body");
  },
  "workout/correction": async page => { await focusMode(page); await logCurrentSet(page); await page.locator("#workout .exercise.is-current [data-editn]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); },
  "today/draft-resume": async page => { await focusMode(page); await page.locator("#workout .exercise.is-current [data-k$='_load']").fill("80"); await page.click("#leaveWorkout"); },

  "workout/stale-draft": async (page) => {
    await enterWorkout(page);
    await page.evaluate(async () => {
      const hook = window.__repforgeWorkoutDraft;
      const draft = hook.current();
      const exerciseInstanceId = draft.session.selectedExerciseId;
      const setId = draft.exercises[exerciseInstanceId].setOrder[0];
      const operationId = "catalog-stale-winner";
      const next = window.RepForgeWorkoutDraft.reduce(draft, {
        type: "editSetField", exerciseInstanceId, setId, field: "load", value: "75",
        operationId, expectedRevision: draft.revision,
        updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
        writer: { ...draft.writer, operationId },
      });
      await hook.cas({
        expectedDraftId: draft.draftId,
        expectedRevision: draft.revision,
        operationId,
        nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)),
      });
    });
    const input = page.locator('#workout [data-k$="_1_load"]').first();
    await input.fill("82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "stale");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  "workout/persist-retry": async (page) => {
    await enterWorkout(page);
    await page.evaluate(() => { window.__repforgeDraftFault = "before-canonical-write"; });
    const input = page.locator('#workout [data-k$="_1_load"]').first();
    await input.fill("82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "persist");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  "workout/invalid-draft": async (page) => {
    await page.evaluate((draftKey) => localStorage.setItem(draftKey, '{"schemaVersion":2,"truncated":'), LOG_DRAFT);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeWorkoutDraft?.recovery()?.kind === "invalid");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  "workout/rest-timer": async (page) => {
    await focusMode(page);
    await logCurrentSet(page);
    await page.waitForFunction(
      () => document.querySelector("#woRest")?.classList.contains("is-running"),
      undefined, { timeout: 20000 }
    );
    await page.click("#woRest");
    await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/exercise-note": async (page) => {
    await focusMode(page);
    await page.locator("#workout [data-exnote-open]").first().click({ timeout: 20000 });
    await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/why-this-weight": async (page) => {
    await enterWorkout(page);
    await page.click("#workout [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "session/summary": saveWholeSession,
  "session/summary-maintained": async (page) => {
    await saveWholeSession(page);
    await page.waitForSelector('.sum-outcome[data-outcome="maintained"]', { timeout: 20000 });
  },
  "session/summary-declined": async (page) => {
    await saveWholeSession(page);
    await page.waitForSelector('.sum-outcome[data-outcome="declined"]', { timeout: 20000 });
  },
  "session/summary-mixed": async (page) => {
    await saveMixedSummarySession(page);
    await page.waitForSelector('.sum-outcome[data-outcome="declined"]', { timeout: 20000 });
    await page.waitForSelector('.sum-outcome[data-outcome="improved"]', { timeout: 20000 });
  },

  "progress/overview": (page) => view(page, "stats"),
  "progress/overview-baseline": (page) => view(page, "stats"),
  "progress/overview-action": (page) => view(page, "stats"),
  "progress/exercise-chart": async (page) => {
    await view(page, "stats");
    await page.evaluate(() => {
      const select = document.querySelector("#statExercise");
      if (!select) return;
      const option = [...select.options].find((o) => /Barbell back squat/i.test(o.textContent));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.evaluate(() => document.querySelector(".chartcard")?.scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#chart");
      if (!canvas || !canvas.width) return false;
      const box = canvas.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    }, undefined, { timeout: 20000 });
    await sleep(page, 500);
  },
  "progress/strength": (page) => progressSegment(page, "strength"),
  "progress/strength-current-block": (page) => progressSegment(page, "strength"),
  "progress/strength-all-history": async (page) => { await progressSegment(page, "strength"); await page.click('#strengthScopeSeg [data-scope="all-history"]'); },
  "progress/strength-comparison": async (page) => { await progressSegment(page, "strength"); const key=await page.evaluate(()=>[...document.querySelectorAll("#strengthDash [data-evkey]")].map(row=>row.dataset.evkey).find(id=>window.__repforgeProgressEvidence.strength(id)?.presentation==="comparison"));const row=page.locator(`#strengthDash [data-evkey="${key}"]`);await row.scrollIntoViewIfNeeded();await row.click(); },
  "progress/strength-sparse": async (page) => { await progressSegment(page, "strength"); const key=await page.evaluate(()=>[...document.querySelectorAll("#strengthDash [data-evkey]")].map(row=>row.dataset.evkey).find(id=>window.__repforgeProgressEvidence.strength(id)?.evidenceState==="insufficient"));const row=page.locator(`#strengthDash [data-evkey="${key}"]`);await row.scrollIntoViewIfNeeded(); },
  "progress/volume": (page) => progressSegment(page, "volume"),
  "progress/volume-block": async (page) => { await progressSegment(page, "volume"); await page.click('#volumeScopeSeg [data-vscope="block-to-date"]'); },
  "progress/volume-drill-in": async (page) => { await progressSegment(page, "volume"); await page.locator("#volumeDash [data-volume-muscle]").first().click(); },
  "progress/prs": (page) => progressSegment(page, "prs"),
  "progress/prs-drill-in": async (page) => { await progressSegment(page, "prs"); await page.locator("#prTimeline .prtl__row").first().click(); },
  "progress/review": (page) => progressSegment(page, "review"),
  "progress/review-active": (page) => progressSegment(page, "review"),
  "progress/review-complete": openCompletedReview,
  "progress/review-insufficient": openCompletedReview,
  "progress/schedule-diagnosis": openScheduleDiagnosis,
  "progress/sibling-lower-frequency": (page) => openSiblingPreview(page, "fewer_days"),
  "progress/sibling-shorter-session": (page) => openSiblingPreview(page, "sessions_too_long"),
  "progress/guided-repair": async (page) => { await openCompletedReview(page);await page.click('[data-review-action="guided-edit"]');await page.fill("[data-diag-target]","3");await page.click("[data-diag-continue]");await page.waitForSelector(".review__staged",{timeout:20000}); },
  "progress/volume-reduction-preview": async (page) => { await completeCompiledProgram(page);await openCompletedReview(page);await page.click('[data-review-action="reduce-volume"]');await page.click("[data-volume-confirm]");await page.waitForSelector("[data-preview-confirm]",{timeout:20000}); },
  "progress/recovery-ineligible": async (page) => { await openRecoveryPreview(page);await page.click('[data-recovery-answer="Not sure"]'); },
  "progress/recovery-questions": openRecoveryPreview,
  "progress/recovery-preview": recoveryPreview,
  "progress/recovery-active": confirmRecovery,
  "progress/recovery-reassessment": async (page) => { await confirmRecovery(page);await page.evaluate(async()=>{const state=window.__repforgeWorkoutDraft.state();const date=new Date(`${state.programMeta.started}T12:00:00`);date.setDate(date.getDate()-8);state.programMeta.started=date.toISOString().slice(0,10);await window.__repforgeCommitProposedState(state);await window.__repforgeStorage.flush();});await page.reload({waitUntil:"domcontentloaded"});await progressSegment(page,"review"); },

  "history/list": (page) => view(page, "history"),
  "history/session": async (page) => {
    await view(page, "history");
    // One auto-waiting click, not a scroll followed by a click: the session
    // list re-renders after its first paint, and a separate scroll step gives
    // that re-render a second chance to detach the element mid-operation.
    await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
    await sleep(page, 500);
    await page.locator("#sessions .session__open").first().click({ timeout: 30000 });
    await page.waitForSelector(".session--read", { timeout: 20000 });
    await page.waitForSelector("[data-history-edit]", { timeout: 20000 });
    // The read actions are the destructive boundary at large text. Capture the
    // scroll-end state so the fixed navigation cannot hide Edit or Delete in
    // the PT+200 matrix.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(page, 400);
  },
  "history/edit-dirty": async (page) => {
    await openHistoryEditor(page);
    await page.locator('.session--edit input[data-ek^="load|"]').first().fill("175");
    await sleep(page, 500);
  },
  "history/edit-invalid": async (page) => {
    await openHistoryEditor(page);
    await page.locator('.session--edit input[data-ek^="load|"]').first().fill("x");
    await page.locator("[data-edsave]").click();
    await page.waitForSelector('.session--edit input[aria-invalid="true"]', { timeout: 20000 });
    // Validation announces the failure through the transient toast as well as
    // the field state. Wait for that announcement to finish so the catalog
    // captures the stable editor rather than depending on toast timing.
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return !toast || toast.classList.contains("hidden");
    }, undefined, { timeout: 10000 });
    await sleep(page, 400);
  },
  "history/delete-confirm": async (page) => {
    await view(page, "history");
    await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
    await page.locator("#sessions .session__open").first().click();
    await page.waitForSelector(".session--read", { timeout: 20000 });
    await page.locator("[data-del]").click();
    await page.waitForSelector("[data-history-delete-confirm]", { timeout: 20000 });
    await sleep(page, 400);
  },
  "history/conflict": async (page) => {
    await openHistoryEditor(page);
    await page.locator('.session--edit input[data-ek^="load|"]').first().fill("175");
    await page.evaluate(async () => {
      const next = structuredClone(JSON.parse(localStorage.getItem("repforge_v1") || "{}"));
      const session = document.querySelector(".session--edit")?.dataset.editing;
      const target = next.log?.find((row) => row.session === session);
      if (!target) throw new Error("history conflict fixture has no log row");
      target.load = Number(target.load) + 7.5;
      const result = await window.__repforgeCommitProposedState(next);
      if (!(result?.committed === true && result?.settled === true)) throw new Error("history conflict commit failed");
      await window.__repforgeStorage.flush();
    });
    await page.locator("[data-edsave]").click();
    await page.waitForSelector('[data-history-operation="conflict"]', { timeout: 20000 });
    await sleep(page, 400);
  },

  "library/list": openLibrary,
  "library/exercise-preview": async (page) => {
    await openLibrary(page);
    const preview = page.locator('#libList [data-lib-preview="sq_bb"]');
    if (await preview.count()) await preview.click();
    else await page.locator("#libList [data-lib-preview]").first().click();
    await sleep(page, 600);
  },
  "library/exercise-detail": async (page) => {
    // Workout rows carry per-session generated ids, not the program's fixture
    // ids, so address the first row rather than naming one.
    await enterWorkout(page);
    const row = page.locator("#workout [data-exopen]").first();
    await row.scrollIntoViewIfNeeded({ timeout: 20000 });
    await row.click({ timeout: 20000 });
    await sleep(page, 800);
  },

  "program/no-program": async (page) => { await dismissChrome(page); await openProgram(page); },
  "program/overview": openProgram,
  "program/progression-editor": async (page) => {
    await openProgram(page);
    await page.click("#programEditToggle");
    await page.waitForSelector('#programEditor [data-role="editor"]', { timeout: 20000 });
    // The installed editor is the canonical program-editing surface. Keep the
    // historical catalog key so existing links and committed frame paths stay
    // stable while the scenario follows the shared editor.
    const editor = page.locator('#programEditor [data-role="exercise"]').first();
    await editor.scrollIntoViewIfNeeded();
    await sleep(page, 400);
  },
  "program/exercise-picker": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "multi" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await sleep(page, 500);
  },
  "program/custom-exercise": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "single" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.locator("#exPickSheet [data-act='custom'], #exPickSheet button")
      .filter({ hasText: /custom|personalizad/i }).first().click({ timeout: 20000 });
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/custom-exercise-saving": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "single" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.locator("#exPickSheet [data-act='custom'], #exPickSheet button")
      .filter({ hasText: /custom|personalizad/i }).first().click({ timeout: 20000 });
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.locator("#exCustomName").fill("Paused cable row");
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      io.writeIdb = () => new Promise(() => {});
    });
    await page.locator("#exCustomSave").click();
    await page.waitForFunction(() => {
      const sheet = document.querySelector("#exCustomSheet");
      return sheet?.getAttribute("aria-busy") === "true" &&
        document.querySelector("#exCustomSave")?.disabled;
    });
    await page.locator("#exCustomSheet .custom__form").evaluate(form => { form.scrollTop = 0; });
    await sleep(page, 350);
  },
  "program/custom-exercise-deleting": async (page) => {
    await page.evaluate(() => window.__repforgeOpenLibrary({}));
    await page.waitForSelector("#library.active", { timeout: 20000 });
    await page.locator("#libCustom").click();
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.locator("#exCustomName").fill("Paused cable row");
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    await page.locator("#exCustomSave").click();
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 20000 });
    const customId = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return state.customExercises?.find(entry => entry.name === "Paused cable row")?.id || null;
    });
    if (!customId) throw new Error("The custom deletion fixture was not created through the UI");
    await page.evaluate(id => window.__repforgeEditCustom(id), customId);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const writeIdb = io.writeIdb;
      io.writeIdb = snapshot => new Promise(resolve => {
        window.__releaseCustomDeleteWrite = () => resolve(writeIdb.call(io, snapshot));
      });
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.getAttribute("aria-busy") === "true" &&
      document.querySelector("#exCustomDelete")?.dataset.i18n === "custom.deleting");
    await sleep(page, 350);
  },
  "program/custom-exercise-archiving": async (page) => {
    await createInUseCustomExercise(page);
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      io.writeIdb = () => new Promise(() => {});
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.getAttribute("aria-busy") === "true" &&
      document.querySelector("#exCustomDelete")?.dataset.i18n === "custom.archiving");
    await sleep(page, 350);
  },
  "program/custom-exercise-recovery": async (page) => {
    await createInUseCustomExercise(page);
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const writeIdb = io.writeIdb;
      let calls = 0;
      io.writeIdb = snapshot => ++calls <= 2
        ? Promise.resolve(false)
        : writeIdb.call(io, snapshot);
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => {
      const recovery = document.querySelector("#exCustomRecovery");
      return recovery?.hidden === false &&
        document.querySelector("#exCustomRecoveryRetry")?.hidden === false &&
        document.querySelector("#exCustomRecoveryStatus")?.textContent?.trim();
    }, undefined, { timeout: 20000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return !toast || toast.classList.contains("hidden");
    }, undefined, { timeout: 10000 });
    await resetSheetScroll(page, "#exCustomSheet .custom__form");
    await sleep(page, 350);
  },
  "program/share-setup": async (page) => {
    await openProgram(page);
    await page.click("#shareProgramSetup");
    await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 10000 });
    await sleep(page, 500);
  },
  "program/share-one-blocker": async (page) => {
    await openShare(page);
    await page.waitForSelector("#shareSetupBlockers:not(.hidden)", { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/share-repair-return": async (page) => {
    await openShare(page);
    await page.waitForSelector("#shareSetupBlockers:not(.hidden)", { timeout: 20000 });
    await page.locator("[data-share-repair]").click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.locator("#exPickCustom").click();
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.locator("#exCustomCancel").click();
    await page.waitForFunction(() => {
      const visible = (selector) => {
        const node = document.querySelector(selector);
        return !!node && !node.classList.contains("hidden") && !node.hidden;
      };
      return visible("#shareSetupSheet") && !visible("#exPickSheet") && !visible("#exCustomSheet");
    }, undefined, { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/share-ready": async (page) => {
    await openShare(page);
    await page.waitForSelector("#shareSetupCopy:not(.hidden)", { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/readiness": async (page) => {
    await openProgram(page);
    await page.waitForSelector("#programReadyLink", { timeout: 20000 });
    await page.click("#programReadyLink");
    await page.waitForSelector("#programReadyBack", { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/text-export": async (page) => {
    await openProgram(page);
    await page.click("#exportProgramText");
    await page.waitForSelector("#programTextSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "settings/main": (page) => openSettings(page),
  "settings/appearance": (page) => openSettings(page, "#theme"),
  "settings/guides": async (page) => {
    await openSettings(page, "#guideReplayToggle");
    await page.click("#guideReplayToggle");
    await page.waitForSelector("#guideReplayPanel.is-open");
    await sleep(page, 300);
  },
  "settings/guides-replay": async (page) => {
    await openSettings(page);
    await page.click("#guideReplayToggle");
    await page.waitForSelector("#guideReplayPanel.is-open", { timeout: 20000 });
    await page.locator('#guideReplayList [data-guide-replay="privacy"]').click();
    const cue = page.locator('.guide-cue[data-guide-cue="privacy"]');
    await cue.waitFor({ state: "visible", timeout: 20000 });
    // The replay focuses its dismiss button without scrolling, but the click
    // that opened the panel is allowed to auto-scroll. Establish the frame's
    // subject explicitly so a different preceding scroll position cannot
    // produce a different catalog image.
    await cue.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
    await page.waitForFunction(() => {
      const element = document.querySelector('.guide-cue[data-guide-cue="privacy"]');
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2) <= 1;
    });
    await sleep(page, 400);
  },
  "settings/privacy": (page) => openSettings(page, "#telemetryToggle"),
  "settings/privacy-disclosure": async (page) => {
    await openSettings(page, "#privacyDetails");
    await page.click("#privacyDetails");
    await page.waitForSelector("#privacySheet.is-open", { timeout: 10000 });
    await sleep(page, 300);
  },

  "install/banner": async (page) => {
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt");
      event.prompt = () => {};
      event.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(event);
      window.__repforgeUi.showInstallBanner(false);
    });
    await sleep(page, 500);
    const shown = await page.evaluate(() => {
      const banner = document.querySelector(".installbanner");
      return banner && !banner.classList.contains("hidden");
    });
    if (!shown) throw new Error("install banner did not open");
  },
  "install/ios-sheet": async (page) => {
    await openTransferState(page, "manual");
  },
  "install/transfer-eligible": (page) => openTransferState(page, "eligible"),
  "install/transfer-creating": (page) => openTransferState(page, "creating"),
  "install/transfer-ready": (page) => openTransferState(page, "ready"),
  "install/transfer-retryable": (page) => openTransferState(page, "retryable"),
  "install/transfer-claiming": (page) => openTransferState(page, "claiming"),
  "install/transfer-importing": (page) => openTransferState(page, "importing"),
  "install/transfer-success": (page) => openTransferState(page, "success"),
  "install/transfer-cleanup": (page) => openTransferState(page, "cleanup"),
  "install/transfer-terminal": (page) => openTransferState(page, "terminal"),
  "install/transfer-destination": (page) => openTransferState(page, "destination"),
  "install/transfer-interrupted": (page) => openTransferState(page, "interrupted"),
  "install/transfer-unknown": (page) => openTransferState(page, "unknown"),
  "install/transfer-claimed-expired": (page) => openTransferState(page, "claimed-expired"),
};

/** Transfer surfaces only render under a Safari user agent. The promotion
 * banner stays on Chromium so its catalog state exercises the native install
 * capability and earned-value milestone. */
const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
export const APP_USER_AGENT = Object.fromEntries([
  "ios-sheet", "transfer-eligible", "transfer-creating", "transfer-ready", "transfer-retryable",
  "transfer-claiming", "transfer-importing", "transfer-success", "transfer-cleanup", "transfer-terminal",
  "transfer-destination", "transfer-interrupted", "transfer-unknown", "transfer-claimed-expired",
].map((id) => [`install/${id}`, IOS_SAFARI]));
