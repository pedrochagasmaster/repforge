#!/usr/bin/env node
// Plan 056 P5 — unified Review lifecycle.
// Active-block checkpoint is read-only with no structural confirms; a
// completed block enables only evidence-valid actions; insufficient final
// evidence offers only non-evidence routes; the old competing dialogs are gone.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { default: model } = await import(`${pathToFileURL(path.join(root, "progress-model.js")).href}?p=${fs.statSync(path.join(root, "progress-model.js")).mtimeMs}`);

const program = [
  { id: "e1", day: "Day 1", sets: 2, primary: "Chest" },
  { id: "e2", day: "Day 2", sets: 2, primary: "Hamstrings" },
];
const started = "2026-08-03"; // Monday; 4-week block ends 2026-08-30.
const meta = { started, mesocycleLengthWeeks: 4 };
const now = "2026-08-31T12:00:00";

// Active block: no structural actions, ever.
{
  const active = model.buildReviewCheckpoint(program, meta, [], "2026-08-17T12:00:00");
  assert.equal(active.lifecycle, "active-block");
  assert.deepEqual(active.structuralActions, [], "active checkpoint exposes no structural confirms");
  assert.equal(active.observedOutcomes.length, 0);
}

// Completed block with sufficient evidence: evidence-valid actions only.
{
  const facts = [
    { exerciseId: "e1", evidenceState: "sufficient", outcome: "maintained" },
    { exerciseId: "e2", evidenceState: "sufficient", outcome: "declined" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", observedOutcomes: facts }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  for (const kind of ["repeat", "review", "schedule-repair", "reduce-volume", "guided-edit"]) {
    assert.ok(done.structuralActions.includes(kind), `completed block enables ${kind}`);
  }
  assert.ok(!done.structuralActions.includes("progress"), "no improved outcome means no progress action");
}

// Improved evidence unlocks progress; recovery only with the approved policy flag.
{
  const facts = [
    { exerciseId: "e1", evidenceState: "sufficient", outcome: "improved" },
    { exerciseId: "e2", evidenceState: "sufficient", outcome: "improved" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", observedOutcomes: facts }, [], now);
  assert.ok(done.structuralActions.includes("progress"));
  assert.ok(!done.structuralActions.includes("recovery-week"), "recovery needs the policy gate, not just evidence");
  const recov = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", observedOutcomes: facts, recoveryEligible: true }, [], now);
  assert.ok(recov.structuralActions.includes("recovery-week"));
}

// Insufficient final evidence: only non-evidence structural/manual routes.
{
  const insufficient = [
    { exerciseId: "e1", evidenceState: "insufficient", outcome: undefined },
  ];
  const done = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", observedOutcomes: insufficient }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  assert.deepEqual(done.structuralActions, ["repeat", "schedule-repair", "reduce-volume", "guided-edit"],
    "insufficient final evidence offers repeat plus non-evidence routes, no performance-derived change");
  assert.equal(done.hasSufficientEvidence, false);
  assert.ok(!done.structuralActions.includes("progress"), "no performance-derived transition from insufficient evidence");
}

// The old competing dialogs are gone from the shell.
{
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(!index.includes('id="blockReview"'), "the separate block-review dialog is removed");
  assert.ok(!index.includes('id="endBlockConfirm"'), "the separate end-block confirm dialog is removed");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.ok(!app.includes("successorProgramList"), "successorProgramList is removed as a transition source");
  assert.ok(!app.includes("increase_volume"), "the increase-volume strategy is gone");
  assert.ok(!app.includes("repeat_swaps"), "the swaps strategy is gone");
}

console.log("PASS: progress lifecycle (active read-only, evidence-valid actions, dialogs removed)");

// --- Plan 056/P6: reconstructable schedule repair through the visible Review
// surface. Real compiler proposals via RepForgeProgramTransition; the guided
// fallback stages a setup draft and never archives.
const BROWSER = process.env.REPFORGE_LIFECYCLE_BROWSER === "1";
if (BROWSER) {
  const { chromium } = await import("playwright");
  const { assertServingApp } = await import("./browser.mjs");
  const base = process.env.REPFORGE_URL || "http://127.0.0.1:8617/";
  await assertServingApp(base);
  const browser = await chromium.launch();
  const errors = [];

  async function freshPage() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
    return { context, page };
  }

  async function seedCompiledProgram(page, { days = 4, minutes = 90 } = {}) {
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      for (const reg of regs) await reg.unregister();
      for (const key of await caches?.keys?.() || []) await caches.delete(key);
      localStorage.clear();
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
    const seeded = await page.evaluate(async ({ days, minutes }) => {
      const services = window.__repforgeOnboarding.services();
      const compiled = services.compile({
        mode: "recommend",
        answers: {
          desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most",
          daysPerWeek: days, sessionMinutes: minutes, preferredRestSeconds: 90,
          environment: { kind: "commercial_gym" }, primaryMuscles: [], deEmphasizedMuscles: [],
          ignoredMuscles: [], priorityMovements: [], mustHaveExercises: [], exerciseConstraints: [],
        },
        versions: services.currentVersions(),
      });
      if (!compiled.ok) return { ok: false, code: compiled.code };
      const finalized = await window.__repforgeFinalizeProgramSetup({
        exercises: compiled.preview.program,
        name: "Schedule repair oracle",
        answers: { goal: "balanced", daysPerWeek: days },
        destination: "log",
        origin: "first-run",
        draftConfirmed: true,
        telemetryRoute: "recommend",
        entryTelemetry: compiled.telemetry,
        entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
        programStructure: compiled.preview.programStructure,
        compilerContext: compiled.compilerContext,
      });
      await window.__repforgeStorage.flush();
      return { ok: !!(finalized?.localOk || finalized?.idbOk) };
    }, { days, minutes });
    assert.equal(seeded.ok, true, `compiled program seeded: ${JSON.stringify(seeded)}`);
  }

  async function markBlockComplete(page) {
    const res = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem("repforge_v1"));
      s.programMeta = { ...s.programMeta, mesocycleStatus: "completed" };
      return window.__repforgeCommitProposedState(s);
    });
    await page.evaluate(() => window.__repforgeStorage.flush());
    assert.ok(res.localOk || res.idbOk, "mesocycleStatus flipped through the production commit");
  }

  async function openReview(page) {
    await page.evaluate(() => {
      document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
      document.querySelector('nav button[data-view="stats"]')?.click();
    });
    await page.waitForSelector("#stats.view.active", { timeout: 5000 });
    await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("review"));
    await page.waitForFunction(() => document.querySelector("#segReview")?.classList.contains("active"), null, { timeout: 5000 });
  }

  const stateOf = (page) => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      metaId: s.programMeta.id,
      blockId: s.programMeta.blockId || null,
      historyLen: (s.programHistory || []).length,
      days: [...new Set((s.program || []).map((r) => r.day))].length,
      hasContext: !!s.programMeta.compilerContext,
      setupDraft: localStorage.getItem("repforge_program_setup_draft_v1"),
    };
  });

  async function driveToPreview(page, { kind = "fewer_days", value } = {}) {
    await page.click('[data-review-action="schedule-repair"]');
    await page.waitForSelector("[data-diag-continue]", { timeout: 5000 });
    if (kind !== "fewer_days") await page.click('[data-diag="sessions_too_long"]');
    await page.fill("[data-diag-target]", String(value));
    await page.click("[data-diag-continue]");
    await page.waitForFunction(() =>
      !!document.querySelector("[data-preview-confirm]") || !!document.querySelector(".review__staged"),
    null, { timeout: 15000 });
    return page.evaluate(() => ({
      preview: !!document.querySelector("[data-preview-confirm]"),
      staged: !!document.querySelector(".review__staged"),
      text: document.querySelector("#reviewPanel")?.textContent || "",
    }));
  }

  // Journey A: fewer-days sibling, exact diff, confirmed through the hash.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 4, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    const actions = await page.evaluate(() =>
      [...document.querySelectorAll("#reviewPanel [data-review-action]")].map((b) => b.dataset.reviewAction));
    assert.ok(actions.includes("repeat") && actions.includes("schedule-repair") && actions.includes("guided-edit"),
      "completed block exposes repeat, schedule repair and guided edit");
    const before = await stateOf(page);

    const step = await driveToPreview(page, { kind: "fewer_days", value: 3 });
    assert.equal(step.preview, true, "4→3 fewer-days resolves a compiled sibling");
    assert.match(step.text, /Training days: 4 → 3/, "preview states the frequency change");
    assert.match(step.text, /RIR/, "preview renders the exact changed prescription fields");
    assert.match(step.text, /[0-9a-f]{12,}/i, "preview carries the proposal hash");
    const mid = await stateOf(page);
    assert.equal(mid.historyLen, 0, "previewing archives nothing");
    assert.equal(mid.setupDraft, null, "previewing stages no guided draft");

    await page.click("[data-preview-confirm]");
    await page.waitForFunction(() => !!document.querySelector(".review__staged"), null, { timeout: 15000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const after = await stateOf(page);
    assert.equal(after.metaId !== before.metaId, true, "confirmed sibling activates a new program identity");
    assert.equal(after.historyLen, 1, "confirmed sibling archives the predecessor exactly once");
    assert.equal(after.days, 3, "successor runs the requested 3-day frequency");
    assert.equal(after.hasContext, true, "successor keeps compiler provenance for future transitions");
    assert.equal(after.setupDraft, null, "no guided draft remains");
    await context.close();
  }

  // Journey B: a durable write between preview and confirm makes the commit
  // fail stale, visibly, with nothing modified.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 4, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    await driveToPreview(page, { kind: "fewer_days", value: 3 });
    const before = await stateOf(page);
    // Production durable write through the real Settings control.
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.view.active", { timeout: 5000 });
    await page.evaluate(() => document.querySelector("#progressionDetails")?.classList.add("is-open"));
    const rir = page.locator("#hardRir");
    await rir.fill("3");
    await rir.blur();
    await page.waitForFunction(() => {
      const s = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return Number(s.settings?.hardRir) === 3;
    }, null, { timeout: 10000 });
    await openReview(page);
    const stillPreview = await page.evaluate(() => !!document.querySelector("[data-preview-confirm]"));
    assert.equal(stillPreview, true, "the preview survives navigation through Settings");
    await page.click("[data-preview-confirm]");
    await page.waitForFunction(() => !!document.querySelector(".review__error"), null, { timeout: 15000 });
    const errText = await page.evaluate(() => document.querySelector(".review__error")?.textContent || "");
    assert.match(errText, /out of date/i, "stale commit is named as stale, visibly");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "stale rejection leaves the program unchanged");
    assert.equal(after.historyLen, 0, "stale rejection archives nothing");
    await context.close();
  }

  // Journey C: fewer-days target with no blueprint stages the exact-program
  // guided draft with the diagnosed constraint and no archive.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 3, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    const before = await stateOf(page);
    const step = await driveToPreview(page, { kind: "fewer_days", value: 1 });
    assert.equal(step.staged, true, "unavailable sibling falls back to the guided editor");
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "guided staging never archives");
    assert.equal(after.historyLen, 0, "guided staging creates no archive");
    assert.ok(after.setupDraft, "guided staging persists a setup draft");
    const draft = JSON.parse(after.setupDraft || "{}");
    const diag = draft?.state?.result?.diagnostics || null;
    assert.equal(diag?.mainConstraint, "fewer_days", "the draft carries the diagnosed constraint");
    assert.equal(diag?.daysPerWeek, 1, "the draft carries the exact target");
    await page.click("[data-flow-cancel]");
    await page.waitForFunction(() => localStorage.getItem("repforge_program_setup_draft_v1") === null);
    const cancelled = await stateOf(page);
    assert.equal(cancelled.historyLen, 0, "canceling guided repair still archives nothing");
    await context.close();
  }

  // Journey D: a supported sessions-too-long diagnosis preserves frequency,
  // previews the exact target duration and remains inert before confirmation.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 4, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    const before = await stateOf(page);
    const step = await driveToPreview(page, { kind: "sessions_too_long", value: 60 });
    assert.equal(step.preview, true, "90→60 minutes resolves a same-frequency compiled sibling");
    assert.match(step.text, /Training days: 4 → 4/, "shorter-session preview preserves frequency");
    assert.match(step.text, /Session target: 90 → 60 minutes/, "preview states the exact duration change");
    assert.match(step.text, /Same exercises, same prescriptions/, "shorter-session preview states that no prescription changed");
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "shorter-session preview leaves the program identity untouched");
    assert.equal(after.historyLen, 0, "shorter-session preview archives nothing");
    await page.click("[data-flow-cancel]");
    await context.close();
  }

  // Journey E: sessions-too-long diagnosis at a frequency with no shorter
  // sibling lands on the guided fallback, carrying the minutes target.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 3, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    const step = await driveToPreview(page, { kind: "sessions_too_long", value: 15 });
    assert.equal(step.staged, true, "shorter-session sibling unavailable stages guided repair");
    const after = await stateOf(page);
    const draft = JSON.parse(after.setupDraft || "{}");
    const diag = draft?.state?.result?.diagnostics || null;
    assert.equal(diag?.mainConstraint, "sessions_too_long");
    assert.equal(diag?.sessionMinutes, 15);
    assert.equal(after.historyLen, 0, "still no archive");
    await page.evaluate(() => localStorage.removeItem("repforge_program_setup_draft_v1"));
    await context.close();
  }

  // Journey F: the explicit guided-edit action stages the exact program after
  // the same typed Unavailable boundary as the automatic fallback.
  {
    const { context, page } = await freshPage();
    await seedCompiledProgram(page, { days: 3, minutes: 90 });
    await markBlockComplete(page);
    await openReview(page);
    await page.click('[data-review-action="guided-edit"]');
    await page.waitForSelector("[data-diag-continue]", { timeout: 5000 });
    await page.fill("[data-diag-target]", "1");
    await page.click("[data-diag-continue]");
    await page.waitForFunction(() => !!document.querySelector(".review__staged"), null, { timeout: 15000 });
    const after = await stateOf(page);
    assert.ok(after.setupDraft, "guided edit stages the exact-program draft");
    assert.equal(after.historyLen, 0, "guided edit never archives");
    await page.click("[data-flow-editor]");
    await page.waitForSelector("#onboarding.active", { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.body.classList.contains("is-entry-editor")), true,
      "Open the editor resumes the staged guided candidate");
    await context.close();
  }

  assert.deepEqual(errors, [], "no page errors during schedule repair journeys");
  await browser.close();
  console.log("PASS: schedule repair journeys (sibling diff, stale, guided fallback, no archive)");
}
