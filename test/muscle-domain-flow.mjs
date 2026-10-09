#!/usr/bin/env node
/**
 * Strategy-A muscle-domain proof: custom UI -> shared setup -> activation ->
 * week-two edit -> Progress. (The programStructure-driven planned-volume
 * compaction is retired with Plan 067: canonical programs carry no
 * programStructure, so no compact receipt is written.)
 */
import assert from "node:assert/strict";
import { assertServingApp, launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const SEED_SLOT = "seed-ex-3";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

/** One linked Day 1 slot cut from the seed program's canonical definition. */
function seedSnapshot() {
  const meta = seedProgramMeta();
  const definition = meta.programDefinition;
  for (const day of definition.days) {
    day.slots = day.slots.filter((slot) => slot.id === SEED_SLOT);
    day.slots.forEach((slot) => { slot.order = 1; });
    if (!day.slots.length) day.kind = "rest";
  }
  return {
    program: seedProgram().filter((row) => row.id === SEED_SLOT).map((row) => ({ ...row, order: 1, alternates: [] })),
    programMeta: {
      ...meta, id: "muscle-domain-seed", name: "Muscle domain seed", started: "2026-09-01",
      created: "2026-09-01T00:00:00.000Z", updated: "2026-09-01T00:00:00.000Z", daysPerWeek: 1,
      blockId: "muscle-domain-block", plannedVolumeHistory: null, programDefinition: definition,
    },
  };
}

async function installSnapshot(page) {
  await page.evaluate(async ({ key, seed }) => {
    const base = JSON.parse(localStorage.getItem(key) || "{}");
    const state = {
      ...base,
      ...seed,
      customExercises: [],
      log: [],
      programHistory: [],
      _storageRevision: 1,
    };
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, seed: seedSnapshot() });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

/* The shared-setup codec's options, built from the page's own catalog and compiler. */
const CODEC_OPTIONS = `({
  builtInIds: new Set(window.__repforgeExerciseLibrary.map((entry) => entry.id)),
  catalogSnapshot: window.RepForgeExerciseCatalog.snapshot(),
  validateProgramDefinition: window.RepForgeProgramCompiler.validateProgramDefinition,
  generateProgram: window.RepForgeProgramCompiler.generateProgram,
  generatorVersion: window.RepForgeProgramCompiler.GENERATOR_VERSION,
})`;

async function fixedClock(context) {
  await context.addInitScript(() => {
    globalThis.__repforgeTestNow = "2026-09-10T12:00:00.000Z";
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [globalThis.__repforgeTestNow])); }
      static now() { return new NativeDate(globalThis.__repforgeTestNow).getTime(); }
    }
    globalThis.Date = FixedDate;
  });
}

async function main() {
  await assertServingApp(BASE);
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC", serviceWorkers: "block" });
  await fixedClock(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await installSnapshot(page);

    const initial = await page.evaluate(() => {
      const state = window.__repforgeWorkoutDraft.state();
      return {
        valid: window.__repforgeValidateStateShape(state),
        primary: state.program[0].primary,
        secondary: state.program[0].secondary,
      };
    });
    assert.equal(initial.valid, true, "canonical seed state is valid");
    assert.equal(initial.primary, "Chest", "a linked slot reads its catalog movement's primary muscles");
    assert.equal(initial.secondary, "Triceps,Front delts", "a linked slot reads its catalog movement's secondary muscles");

    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    if (await page.locator("#programEditorWrap").evaluate((node) => node.classList.contains("is-hidden"))) {
      await page.click("#programEditToggle");
    }
    // Created from the editor's Add exercise picker, the custom movement joins
    // the canonical program when the edit is applied.
    await page.click('#programEditor [data-role="add-exercise"][data-day="Day 1"]');
    await page.waitForSelector("#exPickSheet.is-open");
    await page.fill("#exPickSearch", "UI canonical row");
    await page.click("#exPickCustom");
    await page.waitForSelector("#exCustomSheet.is-open");
    await page.fill("#exCustomName", "UI canonical row");
    await page.evaluate(() => {
      const click = (selector, value) => document.querySelector(`${selector} [data-val="${value}"]`)?.click();
      click("#exCustomEquip", "machine");
      click("#exCustomPrimary", "Chest");
      click("#exCustomSecondary", "Triceps");
    });
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden" });
    await page.waitForSelector("#exPickSheet", { state: "hidden" });
    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
    // A new custom movement has no metrics until the lifter chooses what it
    // logs, and a program cannot be activated with an unconfigured slot.
    const customRowId = await page.evaluate(() => window.__repforgeWorkoutDraft.state().program
      .find((row) => row.name === "UI canonical row")?.id);
    await page.click("#programEditToggle");
    const customToggleOwn = page.locator(`#programEditor [data-role="toggle-exercise"][data-id="${customRowId}"]`);
    if (await customToggleOwn.getAttribute("aria-expanded") !== "true") await customToggleOwn.click();
    await page.selectOption(`#programEditor [data-role="metric-composition"][data-id="${customRowId}"]`,
      JSON.stringify([WEIGHT, REPS]));
    await page.click("#programEditToggle");
    const configured = await page.waitForFunction((id) => {
      const state = window.__repforgeWorkoutDraft.state();
      const slots = state.programMeta.programDefinition.days.flatMap((day) => day.slots);
      return document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") &&
        slots.find((slot) => slot.id === id)?.metricIds?.length === 2;
    }, customRowId, { timeout: 5000 }).then(() => true, () => false);
    assert.ok(configured, "Done applies the custom movement's chosen metric composition",
      await page.locator('#programEditor [data-role="editor-status"]').textContent().catch(() => ""));

    const created = await page.evaluate(() => {
      const state = window.__repforgeWorkoutDraft.state();
      const custom = state.customExercises.find((entry) => entry.name === "UI canonical row");
      const row = state.program.find((entry) => entry.libraryId === custom?.id);
      const slots = state.programMeta.programDefinition.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId));
      return { custom, row, inDefinition: slots.includes(custom?.id), valid: window.__repforgeValidateStateShape(state) };
    });
    assert.equal(created.valid, true, "UI-created custom exercise leaves valid durable state");
    assert.equal(created.inDefinition, true, "the custom movement is a slot of the canonical program");
    assert.equal(created.custom.primary, "Chest");
    assert.equal(created.custom.secondary, "Triceps");
    assert.equal(created.row.primary, "Chest");
    assert.equal(created.row.secondary, "Triceps");

    // A shared payload whose custom movement carries an out-of-domain muscle
    // attribution is refused with the typed domain error.
    const ingress = await page.evaluate(async ({ id, options }) => {
      const codec = (0, eval)(options);
      const source = window.__repforgeSharedSetup.build();
      const resultFor = (value) => {
        const payload = structuredClone(source);
        payload.program.customExercises = payload.program.customExercises.map((entry) =>
          entry.id === id ? { ...entry, primary: value } : entry);
        return window.RepForgeSharedSetup.validate(payload, codec);
      };
      const long = Array.from({ length: 129 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join(",");
      return {
        control: (({ ok, code }) => ({ ok, code }))(resultFor("Chest")),
        rows: [
          ["129-token", resultFor(long)],
          ...["__proto__", "prototype", "constructor"].map((label) => [label, resultFor(label)]),
        ].map(([label, result]) => ({ label, ok: result.ok, code: result.code, issues: result.issues || [] })),
      };
    }, { id: created.custom.id, options: CODEC_OPTIONS });
    assert.equal(ingress.control.ok, true, "the unmodified custom attribution validates for sharing", JSON.stringify(ingress.control));
    for (const row of ingress.rows) {
      assert.equal(row.ok, false, `${row.label} shared payload is rejected`);
      assert.equal(row.code, "invalid-program-definition", `${row.label} is refused as an invalid program`);
      assert.ok(row.issues.some((issue) => /primary: invalid muscle attribution/.test(issue)),
        `${row.label} names the custom movement's invalid muscle attribution`, JSON.stringify(row.issues));
    }

    await page.evaluate(() => window.__repforgeOpenLibrary({ day: "Day 1" }));
    await page.waitForSelector("#library.active");
    await page.click('#libTabs button[data-tab="yours"]');
    await page.waitForSelector(`[data-lib-edit="${created.custom.id}"]`);
    await page.click(`[data-lib-edit="${created.custom.id}"]`);
    await page.waitForSelector("#exCustomSheet.is-open");
    await page.evaluate(() => {
      document.querySelector('#exCustomPrimary [data-val="Chest"]')?.click();
      document.querySelector('#exCustomPrimary [data-val="Lats"]')?.click();
    });
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden" });
    await page.waitForSelector("#library.active");

    const edited = await page.evaluate((id) => {
      const state = window.__repforgeWorkoutDraft.state();
      return {
        custom: state.customExercises.find((entry) => entry.id === id),
        row: state.program.find((entry) => entry.libraryId === id),
      };
    }, created.custom.id);
    assert.equal(edited.custom.primary, "Lats", "custom editor persists canonical attribution edits");
    assert.equal(edited.custom.secondary, "Triceps");
    assert.equal(edited.row.primary, "Lats", "linked program row follows the edited canonical definition");

    const shared = await page.evaluate(async (options) => {
      const codec = (0, eval)(options);
      const payload = window.__repforgeSharedSetup.build();
      const checked = window.RepForgeSharedSetup.validate(payload, codec);
      const encoded = checked.ok ? await window.RepForgeSharedSetup.encode(checked.value, codec) : checked;
      const decoded = encoded.ok ? await window.RepForgeSharedSetup.decode(encoded.value, codec) : encoded;
      return { payload, checked, encoded, decoded };
    }, CODEC_OPTIONS);
    assert.equal(shared.checked.ok, true, "UI-created canonical program validates for sharing");
    assert.equal(shared.encoded.ok, true, "UI-created canonical program encodes");
    assert.equal(shared.decoded.ok, true, "shared payload decodes with the same contract");
    const sharedCustom = shared.decoded.value.program.customExercises.find((entry) => entry.name === "UI canonical row");
    assert.equal(sharedCustom.primary, "Lats", "shared round-trip preserves primary identity");
    assert.equal(sharedCustom.secondary, "Triceps", "shared round-trip preserves secondary identity");

    const recipient = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC", serviceWorkers: "block" });
    await fixedClock(recipient);
    const target = await recipient.newPage();
    const targetErrors = [];
    target.on("pageerror", (error) => targetErrors.push(String(error)));
    try {
      await target.goto(`${BASE}#setup=${shared.encoded.value}`, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(target, { base: BASE });
      await target.waitForFunction(() => window.__repforgeSharedSetup?.status === "ready");
      await target.click("#firstRunSharedStart");
      await target.waitForSelector("#entryActivate", { timeout: 10000 });
      await target.click("#entryActivate");
      await target.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, null, { timeout: 20000 });
      await target.evaluate(() => window.__repforgeStorage?.flush?.());

      const activated = await target.evaluate((id) => {
        const state = window.__repforgeWorkoutDraft.state();
        const custom = state.customExercises.find((entry) => entry.id === id || entry.name === "UI canonical row");
        const row = state.program.find((entry) => entry.libraryId === custom?.id);
        return { custom, row, valid: window.__repforgeValidateStateShape(state) };
      }, sharedCustom.id);
      assert.equal(activated.valid, true, "shared activation writes a valid durable state");
      assert.equal(activated.custom.primary, "Lats", "activation preserves the shared primary identity");
      assert.equal(activated.custom.secondary, "Triceps", "activation preserves the shared secondary identity");

      const invalidCommits = await target.evaluate(async () => {
        const base = window.__repforgeWorkoutDraft.state();
        const values = [Array.from({ length: 129 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join(","), "__proto__", "prototype", "constructor"];
        const results = [];
        for (const primary of values) {
          const next = structuredClone(base);
          next.program[0].primary = primary;
          next.customExercises[0].primary = primary;
          const result = await window.__repforgeCommitProposedState(next);
          results.push({ code: result.code, sets: window.__repforgeWorkoutDraft.state().program[0].sets, before: base.program[0].sets });
        }
        return results;
      });
      for (const result of invalidCommits) {
        assert.equal(result.code, "invalid-muscle-domain", "invalid durable attribution is rejected before history projection");
        assert.equal(result.sets, result.before, "invalid attribution does not mutate the live program");
      }

      const startResult = await target.evaluate(async () => {
        const next = structuredClone(window.__repforgeWorkoutDraft.state());
        next.programMeta.started = "2026-09-01";
        const result = await window.__repforgeCommitProposedState(next);
        await window.__repforgeStorage.flush();
        return { ok: !!(result.localOk && result.idbOk), state: window.__repforgeWorkoutDraft.state() };
      });
      assert.equal(startResult.ok, true, "moving the block start back a week commits to both replicas");

      await target.click('nav button[data-view="program"]');
      await target.waitForSelector("#program.view.active");
      if (await target.locator("#programEditorWrap").evaluate((node) => node.classList.contains("is-hidden"))) {
        await target.click("#programEditToggle");
      }
      const customRowId = startResult.state.program.find((entry) => entry.libraryId === activated.custom.id)?.id;
      const customToggle = target.locator(`[data-role="toggle-exercise"][data-id="${customRowId}"]`);
      if (await customToggle.getAttribute("aria-expanded") !== "true") await customToggle.click();
      await target.waitForSelector(`[data-role="adjust"][data-id="${customRowId}"][data-field="sets"][data-delta="1"]`);
      await target.click(`[data-role="adjust"][data-id="${customRowId}"][data-field="sets"][data-delta="1"]`);
      await target.click("#programEditToggle");
      await target.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
      await target.evaluate(() => window.__repforgeStorage.flush());

      const compacted = await target.evaluate((id) => {
        const state = window.__repforgeWorkoutDraft.state();
        return {
          valid: window.__repforgeValidateStateShape(state),
          sets: state.program.find((entry) => entry.id === id)?.sets,
        };
      }, customRowId);
      assert.equal(compacted.valid, true, "edited state remains valid in week two");
      assert.equal(compacted.sets, 4, "week-two Program Editor edit persists");

      await target.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(target, { base: BASE });
      const reloaded = await target.evaluate(() => window.__repforgeWorkoutDraft.state());
      assert.equal(reloaded.program.find((entry) => entry.libraryId.startsWith("custom:"))?.sets, 4, "edited prescription survives reload");

      await target.click('nav button[data-view="stats"]');
      await target.waitForSelector("#stats.view.active");
      await target.evaluate(() => window.__repforgeStatsNav.setEvidenceView("volume"));
      await target.waitForSelector('#volumeDash [data-volume-muscle="Lats"]');
      await target.waitForSelector('#volumeDash [data-volume-muscle="Triceps"]');
      const renderedMuscles = await target.evaluate(() => [
        ...document.querySelectorAll("#volumeDash [data-volume-muscle]"),
      ].map((node) => node.dataset.volumeMuscle));
      assert.ok(renderedMuscles.includes("Lats") && renderedMuscles.includes("Triceps"),
        "Progress renders the canonical muscle totals", renderedMuscles.join(", "));
      assert.deepEqual(targetErrors, [], "shared/import/history flow emits no page errors");
    } finally {
      await recipient.close();
    }
  } finally {
    assert.deepEqual(errors, [], "custom UI flow emits no page errors");
    await context.close();
    await browser.close();
  }

  console.log("muscle-domain flow: canonical ingress, UI, shared round-trip, and week-two edit pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
