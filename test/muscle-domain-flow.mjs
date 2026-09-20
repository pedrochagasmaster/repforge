#!/usr/bin/env node
/**
 * Strategy-A muscle-domain proof: custom UI -> shared setup -> activation ->
 * historical compaction -> Progress.
 */
import assert from "node:assert/strict";
import { assertServingApp, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";

async function installSnapshot(page) {
  await page.evaluate(async (key) => {
    const base = JSON.parse(localStorage.getItem(key) || "{}");
    const state = {
      ...base,
      program: [{
        id: "seed-slot",
        day: "Day 1",
        order: 1,
        name: "Machine press",
        libraryId: "pr_mc",
        sets: 3,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "Front delts",
        notes: "",
        alternates: [],
      }],
      programMeta: {
        ...(base.programMeta || {}),
        id: "muscle-domain-seed",
        name: "Muscle domain seed",
        started: "2026-09-01",
        created: "2026-09-01T00:00:00.000Z",
        updated: "2026-09-01T00:00:00.000Z",
        onboarded: true,
        daysPerWeek: 1,
        mesocycleLengthWeeks: 6,
        mesocycleStatus: "active",
        blockId: "muscle-domain-block",
        programStructure: null,
        plannedVolumeHistory: null,
        progressionRelations: [],
        progressionModifiers: [],
        progressionIncompatibilities: [],
      },
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
  }, KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

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
    assert.equal(initial.primary, "Chest");
    assert.equal(initial.secondary, "Triceps,Front delts");

    const ingress = await page.evaluate(() => {
      const ids = new Set(window.__repforgeExerciseLibrary.map((entry) => entry.id));
      const source = window.__repforgeSharedSetup.build();
      const resultFor = (value) => {
        const payload = structuredClone(source);
        payload.program.customExercises = [{
          id: "custom:domain-adversary",
          name: "Domain adversary",
          equipment: ["machine"],
          primary: value,
          secondary: "",
        }];
        payload.program.exercises = [{
          ...payload.program.exercises[0],
          libraryId: "custom:domain-adversary",
        }];
        return window.RepForgeSharedSetup.validate(payload, { builtInIds: ids });
      };
      const long = Array.from({ length: 129 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join(",");
      return [
        ["129-token", resultFor(long)],
        ...["__proto__", "prototype", "constructor"].map((label) => [label, resultFor(label)]),
      ].map(([label, result]) => ({ label, ok: result.ok, code: result.code }));
    });
    for (const row of ingress) {
      assert.equal(row.ok, false, `${row.label} shared payload is rejected`);
      assert.equal(row.code, "invalid-muscle-domain", `${row.label} gets the typed domain error`);
    }

    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    if (await page.locator("#programEditorWrap").evaluate((node) => node.classList.contains("is-hidden"))) {
      await page.click("#programEditToggle");
    }
    await page.evaluate(() => window.__repforgeOpenLibrary({ day: "Day 1" }));
    await page.waitForSelector("#library.active");
    await page.click("#libCustom");
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
    await page.click("#libPrimary");
    await page.waitForSelector("#libConfigureRows .libcfg");
    await page.click("#libPrimary");
    await page.waitForSelector("#program.view.active");

    const created = await page.evaluate(() => {
      const state = window.__repforgeWorkoutDraft.state();
      const custom = state.customExercises.find((entry) => entry.name === "UI canonical row");
      const row = state.program.find((entry) => entry.libraryId === custom?.id);
      return { custom, row, valid: window.__repforgeValidateStateShape(state) };
    });
    assert.equal(created.valid, true, "UI-created custom exercise leaves valid durable state");
    assert.equal(created.custom.primary, "Chest");
    assert.equal(created.custom.secondary, "Triceps");
    assert.equal(created.row.primary, "Chest");
    assert.equal(created.row.secondary, "Triceps");

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

    const shared = await page.evaluate(async () => {
      const payload = window.__repforgeSharedSetup.build();
      const ids = [...window.__repforgeExerciseLibrary.map((entry) => entry.id)];
      const checked = window.RepForgeSharedSetup.validate(payload, { builtInIds: new Set(ids) });
      const encoded = checked.ok ? await window.RepForgeSharedSetup.encode(checked.value, { builtInIds: new Set(ids) }) : checked;
      const decoded = encoded.ok ? await window.RepForgeSharedSetup.decode(encoded.value, { builtInIds: new Set(ids) }) : encoded;
      return { payload, checked, encoded, decoded };
    });
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
      await target.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), null, { timeout: 10000 });

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
          results.push({ code: result.code, sets: window.__repforgeWorkoutDraft.state().program[0].sets });
        }
        return results;
      });
      for (const result of invalidCommits) {
        assert.equal(result.code, "invalid-muscle-domain", "invalid durable attribution is rejected before history projection");
        assert.equal(result.sets, 3, "invalid attribution does not mutate the live program");
      }

      const startResult = await target.evaluate(async () => {
        const next = structuredClone(window.__repforgeWorkoutDraft.state());
        next.programMeta.started = "2026-09-01";
        const result = await window.__repforgeCommitProposedState(next);
        await window.__repforgeStorage.flush();
        return { ok: !!(result.localOk && result.idbOk), state: window.__repforgeWorkoutDraft.state() };
      });
      assert.equal(startResult.ok, true, "historical compaction seed update commits to both replicas");

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
        const history = state.programMeta.plannedVolumeHistory;
        return {
          valid: window.__repforgeValidateStateShape(state),
          sets: state.program.find((entry) => entry.id === id)?.sets,
          history,
        };
      }, customRowId);
      assert.equal(compacted.valid, true, "edited state remains valid after historical compaction");
      assert.equal(compacted.sets, 4, "week-two Program Editor edit persists");
      assert.equal(compacted.history.throughWeek, 1, "the prior week is represented by one compact receipt");
      assert.equal(compacted.history.muscles.direct.Lats, 3, "direct historical volume is exact");
      assert.equal(compacted.history.muscles.secondary.Triceps, 3, "secondary historical volume is exact");

      await target.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(target, { base: BASE });
      const reloaded = await target.evaluate(() => window.__repforgeWorkoutDraft.state());
      assert.equal(reloaded.programMeta.plannedVolumeHistory.muscles.direct.Lats, 3, "compact history survives reload");
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

  console.log("muscle-domain flow: canonical ingress, UI, shared round-trip, and compact history pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
