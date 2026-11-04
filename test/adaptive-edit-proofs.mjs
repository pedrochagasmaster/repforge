#!/usr/bin/env node
/**
 * Adaptive progression survives Program-editor edits (Plan 069 D3, owner amendment 2026-11-03):
 * what it means in the workout, and that its marker travels.
 *
 * A. An authored load on an adaptive set. A program with history, its next session's first
 *    exercise adaptive; the lifter types a load for that week's first set in the installed
 *    editor. The set stays adaptive (ready), the typed load is kept as the set's target, and
 *    the workout's load field shows the ENGINE's recommendation, not the typed load: while a
 *    set adapts, the engine decides its load.
 * B. The marker of an edited adaptive set, provenance policyVersion "manual-adaptive@1", made
 *    through the real path (generate, activate, swap an exercise in the installed editor):
 *    each week keeps its set count; the program validates; a setup link carries it (a v5 link within the limit that decodes
 *    to the identical program); and a JSON backup restored on another install through
 *    Settings → Import → Replace carries it.
 *
 * Run: node test/adaptive-edit-proofs.mjs   (requires the app served over HTTP)
 */
import { launchChromium, waitForAppBoot, answerRecommend } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";
import { openInstalledEditor, openExerciseSheet, editorSettled, applyInstalledEditor } from "./fixtures/installed-editor.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

async function authoredLoad(browser) {
  console.log("\nA. An authored load on an adaptive set");
  const manifest = loadManifest();
  const capture = { flow: "today", screen: "ready", viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "normal" };
  const opened = await openPage(browser, manifest, capture, appState("today/ready", "en"));
  const page = opened.page;
  try {
    await dismissChrome(page);
    await APP_SCENARIOS["today/ready"](page);
    await settle(page);
    const before = await page.evaluate(() => {
      const ex = prog.forDay(day)[0], cycle = mesocycleWeek().current;
      const slot = state.programMeta.programDefinition.days.flatMap((d) => d.slots).find((s) => s.id === ex.id);
      return { slot: ex.id, cycle, status: slot.prescriptionsByCycle.find((c) => c.cycleIndex === cycle).sets[0].status, engine: recommendation(ex)?.load ?? null };
    });
    assert(before.status === "ready" && Number.isFinite(before.engine), "the next session's first exercise is adaptive and the engine recommends a load", JSON.stringify(before));
    const typed = before.engine === 77.5 ? 72.5 : 77.5;
    await page.click('nav [data-view="program"]');
    await openInstalledEditor(page);
    await openExerciseSheet(page, before.slot);
    await page.locator('#reviewSheet [data-role="weeks-open"]').click();
    await page.locator(`#reviewSheet [data-role="week-row"][data-cycle-index="${before.cycle}"]`).click();
    const field = page.locator(`#reviewSheet [data-role="metric-target"][data-cycle-index="${before.cycle}"][data-set-index="1"][data-semantic="loadKg"]`);
    await field.fill(String(typed));
    await field.blur();
    await editorSettled(page);
    await page.locator('#reviewSheet [data-role="weeks-back"]').click();
    await applyInstalledEditor(page);
    const stored = await page.evaluate(({ slot: id, cycle }) => {
      const set = state.programMeta.programDefinition.days.flatMap((d) => d.slots).find((s) => s.id === id)
        .prescriptionsByCycle.find((c) => c.cycleIndex === cycle).sets[0];
      return { status: set.status, load: set.targets?.loadKg ?? null, engine: recommendation(prog.forDay(day)[0])?.load ?? null };
    }, before);
    assert(stored.status === "ready" && stored.load === typed, "the set stays adaptive and keeps the typed load as its target", JSON.stringify(stored));
    assert(stored.engine === before.engine, "the engine's recommendation is unchanged by the typed load", JSON.stringify({ before: before.engine, after: stored.engine }));
    await page.click('nav [data-view="log"]');
    await page.click("#startWorkout");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 15000 });
    await page.waitForFunction(() => !!activeWorkoutDraft?.exerciseOrder?.length, undefined, { timeout: 10000 });
    const shown = await page.evaluate(() => {
      const input = [...document.querySelectorAll("#workout .shelf__field input")].find((element) => !element.closest(".is-peek") && /_1_(load|metric_)/.test(element.dataset.k || ""));
      return { value: input?.value ?? null, placeholder: input?.placeholder ?? null };
    });
    assert(Number(shown.value) === before.engine && Number(shown.value) !== typed,
      "the workout shows the engine's recommendation, not the typed load", JSON.stringify({ ...shown, engine: before.engine, typed }));
  } finally {
    await opened.context.close();
  }
}

async function policyTravels(browser) {
  console.log("\nB. manual-adaptive@1 travels");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let backup = null, sent = null;
  try {
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
    await answerRecommend(page, { days: 4, minutes: 60, skipBasics: true });
    await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 30000 });
    await page.click("#entryActivate");
    await page.waitForFunction(() => !document.querySelector("#onboarding.active"), undefined, { timeout: 20000 });
    await waitForAppBoot(page, { base: BASE });
    await page.click('nav [data-view="program"]');
    await openInstalledEditor(page);
    const id = await page.locator('#programEditor [data-role="exercise-row"]').first().getAttribute("data-id");
    const original = await page.evaluate((slotId) => state.programMeta.programDefinition.days.flatMap((d) => d.slots).find((s) => s.id === slotId)
      .prescriptionsByCycle.map((cycle) => cycle.sets.length), id);
    await openExerciseSheet(page, id);
    await page.locator('#reviewSheet [data-role="swap-open"]').click();
    await page.waitForSelector('#reviewSheet.is-open [data-pe-sheet="swap"]', { timeout: 5000 });
    await page.locator('#reviewSheet [data-role="swap-choice"]').first().click();
    await editorSettled(page);
    await applyInstalledEditor(page);
    const marked = await page.evaluate((slotId) => {
      const definition = state.programMeta.programDefinition;
      const slot = definition.days.flatMap((d) => d.slots).find((s) => s.id === slotId);
      const sets = slot.prescriptionsByCycle.flatMap((cycle) => cycle.sets);
      return { counts: slot.prescriptionsByCycle.map((cycle) => cycle.sets.length), ready: sets.every((set) => set.status === "ready"), policies: [...new Set(sets.map((set) => set.provenance?.policyVersion))],
        valid: ProgramCompiler.validateProgramDefinition(definition).ok === true };
    }, id);
    assert(marked.ready && marked.policies.length === 1 && marked.policies[0] === "manual-adaptive@1",
      "a swap to a supported movement keeps the exercise adaptive and marks its sets manual-adaptive@1", JSON.stringify(marked));
    assert(JSON.stringify(marked.counts) === JSON.stringify(original),
      "the swap keeps each week's set count (a one-set deload week stays one set)", JSON.stringify({ before: original, after: marked.counts }));
    assert(marked.valid, "the program with manual-adaptive@1 validates (the install-transfer and import gate)");
    sent = await page.evaluate(() => JSON.stringify(canonicalize(state.programMeta.programDefinition)));

    await page.click("#shareProgramSetup");
    await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 10000 });
    await page.waitForFunction(() => !!document.querySelector("#shareSetupLink")?.textContent?.trim() || !!document.querySelector("#shareSetupFile:not(.hidden)"), undefined, { timeout: 20000 });
    const shared = await page.evaluate(async () => {
      const link = document.querySelector("#shareSetupLink")?.textContent?.trim() || "";
      const fragment = link.includes("#setup=") ? link.slice(link.indexOf("#setup=") + 7) : "";
      const decoded = fragment ? await SharedSetup.decode(fragment, sharedSetupDecodeCodecOptions()) : null;
      return { wire: fragment.split(".")[0], chars: fragment.length, limit: SharedSetup.MAX_ENCODED_CHARS,
        received: decoded?.ok ? JSON.stringify(canonicalize(decoded.value.program.definition)) : decoded?.code ?? null };
    });
    assert(shared.wire === "v5" && shared.chars <= shared.limit, "the setup link is a v5 link within the limit", JSON.stringify({ wire: shared.wire, chars: shared.chars }));
    assert(shared.received === sent && shared.received.includes("manual-adaptive@1"), "the link decodes to the identical program, manual-adaptive@1 included");
    backup = await page.evaluate(() => JSON.stringify(exportableState(state)));
  } finally {
    await context.close();
  }

  const restore = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const target = await restore.newPage();
  try {
    await target.goto(BASE);
    await waitForAppBoot(target, { base: BASE });
    await target.evaluate(() => window.__repforgeShowSettings());
    await target.locator("#importJson").setInputFiles({ name: "taurifer_backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
    await target.waitForSelector("#importChoice[open]", { timeout: 10000 });
    await target.click("#importReplace");
    await target.waitForFunction((want) => JSON.stringify(canonicalize(window.__repforgeWorkoutDraft?.state?.()?.programMeta?.programDefinition || null)) === want,
      sent, { timeout: 15000 }).then(() => true, () => false);
    const restored = await target.evaluate(() => JSON.stringify(canonicalize(state.programMeta?.programDefinition || null)));
    assert(restored === sent, "a backup restored through Settings → Import → Replace holds the identical program, manual-adaptive@1 included");
  } finally {
    await restore.close();
  }
}

const browser = await launchChromium();
try {
  await authoredLoad(browser);
  await policyTravels(browser);
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
