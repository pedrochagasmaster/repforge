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
    { exerciseId: "e1", evidenceState: "sufficient", evidenceCount: 2, outcome: "maintained" },
    { exerciseId: "e2", evidenceState: "sufficient", evidenceCount: 2, outcome: "declined" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", evidenceRecords: facts }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  for (const kind of ["repeat", "review", "schedule-repair", "reduce-volume", "guided-edit"]) {
    assert.ok(done.structuralActions.includes(kind), `completed block enables ${kind}`);
  }
  assert.ok(!done.structuralActions.includes("progress"), "no improved outcome means no progress action");
}

// Improved evidence unlocks progress; recovery only with the approved policy flag.
{
  const facts = [
    { exerciseId: "e1", evidenceState: "sufficient", evidenceCount: 2, outcome: "improved" },
    { exerciseId: "e2", evidenceState: "sufficient", evidenceCount: 2, outcome: "improved" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", evidenceRecords: facts }, [], now);
  assert.ok(done.structuralActions.includes("progress"));
  assert.ok(!done.structuralActions.includes("recovery-week"), "recovery needs the policy gate, not just evidence");
  const recov = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", evidenceRecords: facts, recoveryEligible: true }, [], now);
  assert.ok(recov.structuralActions.includes("recovery-week"));
}

// Insufficient final evidence: only non-evidence structural/manual routes.
{
  const insufficient = [
    { exerciseId: "e1", evidenceState: "insufficient", outcome: undefined },
  ];
  const done = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", evidenceRecords: insufficient }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  assert.deepEqual(done.structuralActions, ["repeat", "schedule-repair", "reduce-volume", "guided-edit"],
    "insufficient final evidence offers repeat plus non-evidence routes, no performance-derived change");
  assert.equal(done.hasSufficientEvidence, false);
  assert.ok(!done.structuralActions.includes("progress"), "no performance-derived transition from insufficient evidence");
}

console.log("PASS: progress lifecycle (active read-only and evidence-valid actions)");

// --- Plan 067: schedule repair through the visible Review surface. Real
// generated programs and real successor proposals; a change the generator
// cannot make stages guided editing of the live definition and never archives.
const BROWSER = process.env.REPFORGE_LIFECYCLE_BROWSER === "1";
if (BROWSER) {
  const { launchChromium, waitForAppBoot } = await import("./browser.mjs");
  const base = process.env.REPFORGE_URL || "http://localhost:8000/";
  const browser = await launchChromium();
  const errors = [];
  const DAY = 86400000;
  const START = Date.parse("2026-03-02T09:00:00.000Z");

  async function freshPage() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.clock.setFixedTime(new Date(START));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    return { context, page };
  }

  async function seedGeneratedProgram(page, { days = 4, minutes = 90 } = {}) {
    const seeded = await page.evaluate(async ({ days, minutes }) => {
      const catalog = window.RepForgeExerciseCatalog.snapshot();
      const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: days,
        sessionMinutes: minutes, environment: { kind: "commercial_gym" },
      }, catalog);
      if (!request.ok) return { ok: false, request };
      const generated = window.RepForgeProgramCompiler.generateProgram(request.value, catalog, `lifecycle-${days}-${minutes}`);
      if (!generated.ok) return { ok: false, generated };
      const finalized = await window.__repforgeFinalizeProgramSetup({
        programDefinition: generated.value, name: "Schedule repair oracle", answers: {}, destination: "log",
        origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
        entrySource: { route: "recommend", fingerprint: `lifecycle-${days}-${minutes}` },
      });
      await window.__repforgeStorage.flush();
      return { ok: !!(finalized?.localOk || finalized?.idbOk) };
    }, { days, minutes });
    assert.equal(seeded.ok, true, `generated program seeded: ${JSON.stringify(seeded).slice(0, 1500)}`);
  }

  /** The block ends by the calendar, the way a lifter reaches Review. */
  async function finishBlock(page) {
    const meta = await page.evaluate(() => window.__repforgeWorkoutDraft.state().programMeta);
    await page.clock.setFixedTime(new Date(Date.parse(`${meta.started}T09:00:00.000Z`) + (meta.mesocycleLengthWeeks * 7 + 1) * DAY));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
  }

  async function openReview(page) {
    if (await page.locator("#settings.view.active").count()) await page.locator("#settingsBack").click();
    await page.locator('nav button[data-view="stats"]').click();
    await page.locator('#statsSeg [data-seg="review"]').click();
    await page.locator("#reviewPanel").waitFor({ state: "visible" });
  }

  const stateOf = (page) => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    const definition = s.programMeta.programDefinition;
    return {
      metaId: s.programMeta.id,
      historyLen: (s.programHistory || []).length,
      days: definition.days.filter((day) => day.kind === "training").length,
      request: definition.request,
      definition: JSON.stringify(definition),
      setupDraft: localStorage.getItem("repforge_program_setup_draft_v1"),
    };
  });

  async function driveToPreview(page, { action = "schedule-repair", kind = "fewer_days", value } = {}) {
    await page.click(`[data-review-action="${action}"]`);
    await page.waitForSelector("[data-diag-continue]", { timeout: 5000 });
    await page.click(`[data-diag="${kind}"]`);
    await page.fill("[data-diag-target]", String(value));
    await page.click("[data-diag-continue]");
    await page.waitForFunction(() =>
      !!document.querySelector("[data-preview-confirm]") || !!document.querySelector(".review__staged"),
    null, { timeout: 15000 });
    return page.evaluate(() => ({
      preview: !!document.querySelector("[data-preview-confirm]"),
      staged: !!document.querySelector(".review__staged"),
      text: document.querySelector("#reviewPanel")?.innerText || "",
    }));
  }

  // Journey A: a fewer-days successor previews its exact diff and changes
  // nothing until it is confirmed by its hash.
  {
    const { context, page } = await freshPage();
    await seedGeneratedProgram(page, { days: 4, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    const actions = await page.evaluate(() =>
      [...document.querySelectorAll("#reviewPanel [data-review-action]")].map((b) => b.dataset.reviewAction));
    assert.ok(actions.includes("repeat") && actions.includes("schedule-repair") && actions.includes("guided-edit"),
      "completed block exposes repeat, schedule repair and guided edit");
    const before = await stateOf(page);

    const step = await driveToPreview(page, { kind: "fewer_days", value: 3 });
    assert.equal(step.preview, true, "4→3 fewer-days resolves a generated successor");
    assert.match(step.text, /Training days: 4 → 3/, "preview states the frequency change");
    assert.match(step.text, /[0-9a-f]{12,}/i, "preview carries the proposal hash");
    const mid = await stateOf(page);
    assert.equal(mid.metaId, before.metaId, "previewing leaves the program identity untouched");
    assert.equal(mid.definition, before.definition, "previewing leaves the live definition untouched");
    assert.equal(mid.historyLen, 0, "previewing archives nothing");
    assert.equal(mid.setupDraft, null, "previewing stages no guided draft");

    await page.click("[data-preview-confirm]");
    await page.waitForFunction(() => !!document.querySelector(".review__staged"), null, { timeout: 15000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const after = await stateOf(page);
    assert.notEqual(after.metaId, before.metaId, "confirmed successor activates a new program identity");
    assert.equal(after.historyLen, 1, "confirmed successor archives the predecessor exactly once");
    assert.equal(after.days, 3, "successor runs the requested 3-day frequency");
    assert.equal(after.request?.daysPerWeek, 3, "successor keeps its generator request for future transitions");
    assert.equal(after.setupDraft, null, "no guided draft remains");
    await context.close();
  }

  // Journey B: a durable write between preview and confirm makes the commit
  // fail stale, visibly, with nothing modified. The preview survives a trip
  // through Settings.
  {
    const { context, page } = await freshPage();
    await seedGeneratedProgram(page, { days: 4, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    await driveToPreview(page, { kind: "fewer_days", value: 3 });
    const before = await stateOf(page);
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.view.active", { timeout: 5000 });
    await page.locator("#unit").selectOption("lb");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").settings?.unit === "lb",
      null, { timeout: 10000 });
    await openReview(page);
    const stillPreview = await page.evaluate(() => !!document.querySelector("[data-preview-confirm]"));
    assert.equal(stillPreview, true, "the preview survives navigation through Settings");
    await page.click("[data-preview-confirm]");
    await page.waitForFunction(() => !!document.querySelector(".review__error"), null, { timeout: 15000 });
    const errText = await page.evaluate(() => document.querySelector(".review__error")?.textContent || "");
    assert.match(errText, /changed|newer|again|out of date/i, "stale commit is named as stale, visibly");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "stale rejection leaves the program unchanged");
    assert.equal(after.definition, before.definition, "stale rejection leaves the definition unchanged");
    assert.equal(after.historyLen, 0, "stale rejection archives nothing");
    await context.close();
  }

  // Journey C: a fewer-days target the generator cannot meet stages the
  // exact-program guided draft with the diagnosed constraint and no archive.
  {
    const { context, page } = await freshPage();
    await seedGeneratedProgram(page, { days: 3, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    const before = await stateOf(page);
    const step = await driveToPreview(page, { kind: "fewer_days", value: 1 });
    assert.equal(step.staged, true, "an impossible successor falls back to the guided editor");
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "guided staging never archives");
    assert.equal(after.historyLen, 0, "guided staging creates no archive");
    assert.ok(after.setupDraft, "guided staging persists a setup draft");
    const draft = JSON.parse(after.setupDraft || "{}");
    assert.equal(JSON.stringify(draft?.state?.result?.preview?.programDefinition), before.definition,
      "the draft carries the live definition for editing");
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
    await seedGeneratedProgram(page, { days: 4, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    const before = await stateOf(page);
    const step = await driveToPreview(page, { kind: "sessions_too_long", value: 60 });
    assert.equal(step.preview, true, "90→60 minutes resolves a same-frequency generated successor");
    assert.match(step.text, /Session target: 90 → 60 minutes/, "preview states the exact duration change");
    assert.doesNotMatch(step.text, /Training days:/, "a shorter-session preview proposes no frequency change");
    const after = await stateOf(page);
    assert.equal(after.metaId, before.metaId, "shorter-session preview leaves the program identity untouched");
    assert.equal(after.definition, before.definition, "shorter-session preview leaves the definition untouched");
    assert.equal(after.historyLen, 0, "shorter-session preview archives nothing");
    await page.click("[data-flow-cancel]");
    await context.close();
  }

  // Journey E: a session ceiling the generator cannot fit lands on the guided
  // fallback, carrying the minutes target.
  {
    const { context, page } = await freshPage();
    await seedGeneratedProgram(page, { days: 3, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    const step = await driveToPreview(page, { kind: "sessions_too_long", value: 15 });
    assert.equal(step.staged, true, "an unfit shorter-session successor stages guided repair");
    const after = await stateOf(page);
    const draft = JSON.parse(after.setupDraft || "{}");
    const diag = draft?.state?.result?.diagnostics || null;
    assert.equal(diag?.mainConstraint, "sessions_too_long");
    assert.equal(diag?.sessionMinutes, 15);
    assert.equal(after.historyLen, 0, "still no archive");
    await context.close();
  }

  // Journey F: the explicit guided-edit action stages the exact program and
  // opens it in the program editor.
  {
    const { context, page } = await freshPage();
    await seedGeneratedProgram(page, { days: 3, minutes: 90 });
    await finishBlock(page);
    await openReview(page);
    const step = await driveToPreview(page, { action: "guided-edit", kind: "fewer_days", value: 2 });
    assert.equal(step.staged, true, "guided edit stages without proposing a successor");
    const after = await stateOf(page);
    assert.ok(after.setupDraft, "guided edit stages the exact-program draft");
    assert.equal(after.historyLen, 0, "guided edit never archives");
    await page.click("[data-flow-editor]");
    await page.locator("#onbProgramEditor").waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.evaluate(() => document.body.classList.contains("is-entry-editor")), true,
      "Open the editor resumes the staged guided candidate");
    await context.close();
  }

  assert.deepEqual(errors, [], "no page errors during schedule repair journeys");
  await browser.close();
  console.log("PASS: schedule repair journeys (successor diff, stale, guided fallback, no archive)");
}
