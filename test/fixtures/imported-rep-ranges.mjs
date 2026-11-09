import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { legacyRelease } from "./legacy-release.mjs";
import { answerEffortChoice } from "../browser.mjs";
import { importInto } from "./install-transfer-import.mjs";

const OLD_RELEASE_SHA = "349054ab156ffe8dc8fc49565cfa427b8ef6be9d";
const KEY = "repforge_program_setup_draft_v1";
const REPS = '["2555c6f170d88072bbf6d9ad3f16ea86"]';
const DURATION = '["2555c6f170d88063941ef7c8956d760c"]';
const slots = preview => preview.programDefinition.days.flatMap(day => day.slots);
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, KEY);
const boot = page => page.waitForFunction(() => window.__repforgeBooted === true);

async function resume(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await boot(page);
  await page.click("#firstRunResumeSetup");
  await page.locator("#entryEditorActivate, #entryEdit").first().waitFor();
  if (await page.locator("#entryConflictReview").isVisible()) await page.click("#entryConflictReview");
  if (await page.locator("#entryEdit").isVisible()) await page.click("#entryEdit");
  await page.locator('#onbProgramEditor [data-role="metric-composition"]').first().waitFor();
}

async function configure(page, slotId, value) {
  const exercise = page.locator(`#onbProgramEditor [data-role="exercise"][data-id="${slotId}"]`);
  const day = exercise.locator('xpath=ancestor::*[@data-role="day"]');
  if (!await exercise.isVisible()) await day.locator('[data-role="toggle-day"]').click();
  const toggle = exercise.locator('[data-role="toggle-exercise"]');
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await exercise.locator('[data-role="metric-composition"]').selectOption(value);
  await page.waitForFunction(({ key, slotId, value }) => {
    const state = JSON.parse(localStorage.getItem(key));
    const slot = state.state.result.preview.programDefinition.days.flatMap(day => day.slots).find(slot => slot.id === slotId);
    return JSON.stringify(slot.metricIds) === value;
  }, { key: KEY, slotId, value });
}

async function replicas(page) {
  return page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const idb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction("kv").objectStore("kv").get("repforge_v1");
        get.onsuccess = () => { db.close(); resolve(get.result); };
        get.onerror = () => { db.close(); reject(get.error); };
      };
    });
    return { local: JSON.parse(localStorage.getItem("repforge_v1")), idb, setup: localStorage.getItem("repforge_program_setup_draft_v1") };
  });
}

async function verifyPreviousRelease(browser, base, storage, check) {
  const release = legacyRelease(OLD_RELEASE_SHA);
  for (const control of [false, true]) {
    const context = await browser.newContext({ storageState: storage, serviceWorkers: "block" });
    try {
      const page = await context.newPage();
      await page.route("**/*", route => {
        const path = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, "") || "index.html";
        const body = release.file(path);
        if (!body) return route.abort();
        const ext = path.split(".").pop();
        return route.fulfill({ body, contentType: ({ html: "text/html", js: "application/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml" })[ext] || "application/octet-stream" });
      });
      if (control) await page.addInitScript(key => {
        const record = JSON.parse(localStorage.getItem(key));
        delete record.state.result.preview.importedRepRanges;
        localStorage.setItem(key, JSON.stringify(record));
        localStorage.removeItem("repforge_import_ranges_v1");
      }, KEY);
      await page.goto(base);await boot(page);
      const resumable = await page.locator("#firstRunResumeSetup").isVisible();
      await page.click(resumable ? "#firstRunResumeSetup" : "#firstRunCreate");
      await page.waitForSelector("#onboarding.active");
      const kept = await page.evaluate(key => {
        const raw = localStorage.getItem(key);
        return raw && window.RepForgeProgramEntry.normalizeSetupDraftEnvelope(raw).ok;
      }, KEY);
      check(resumable && kept, `previous complete release keeps and resumes ${control ? "the unchanged control" : "the pending-range draft"}`);
    } finally { await context.close(); }
  }
}

async function verifyRecoveryExport(page, active, check) {
  // Recreate termination after the durable commit and before setup cleanup.
  await page.evaluate(async ({ key, raw }) => {
    localStorage.setItem(key, raw);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge");
      request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ bad: true }, "repforge_v1");
      tx.oncomplete = resolve;tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, raw: active.local._storageSetupActivation.raw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#storageExportA").waitFor();
  const download = page.waitForEvent("download");
  await page.click("#storageExportA");
  const file = await download;
  const bytes = await readFile(await file.path(), "utf8");
  check(file.suggestedFilename() === "taurifer_copy_a.json" && !bytes.includes("importedRepRanges") && !bytes.includes("repforge_import_ranges_v1"),
    "the visible Copy A recovery download excludes pending ranges inside activation receipts");
  await page.click("#storageOverwrite");await boot(page);
  const restored = await replicas(page);
  check(restored.setup === null && restored.local.program[0].max === 8 && restored.idb.program[0].max === 8,
    "boot recovers the committed activation and cleans the exact captured setup after replica damage");
}

export async function verifyImportedRepRanges(browser, base) {
  let passed = 0;
  const check = (condition, message, detail) => {
    assert.ok(condition, `${message}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
    passed++;
    console.log(`  ✓ #669: ${message}`);
  };
  const source = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const destination = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", guides: "live", effortChoice: "live" });
  try {
    const page = await source.newPage();
    page.on("dialog", dialog => dialog.accept());
    await page.goto(base);
    await boot(page);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-hub="import"]');
    await page.click("#onbNext");
    await page.setInputFiles("#importProgram", {
      name: "custom-ranges.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 3, meta: { name: "Imported ranges" }, exercises: [
        { id: "range-a", day: "Day A", order: 1, name: "Range proof cable move A", sets: 2, min: 6, max: 8 },
        { id: "range-b", day: "Day A", order: 2, name: "Range proof cable move B", sets: 1, min: 10, max: 14 },
        { id: "range-time", day: "Day A", order: 3, name: "Range proof timed move", sets: 1, min: 9, max: 11 },
      ] })),
    });
    await page.waitForSelector("#importReview.active");
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-imp-act="custom"]').first().click();
      await page.click('#exCustomEquip [data-val="cable"]');
      await page.locator('#exCustomPrimary .pchip').first().click();
      await page.click("#exCustomSave");
      await page.waitForSelector("#exCustomSheet", { state: "hidden" });
    }
    await page.click("#importCommit");
    await page.click("#entryEdit");
    const original = await read(page);
    const initial = original.result.preview;
    const [a, b, time] = slots(initial).map(slot => slot.id);
    const pendingStorage = await source.storageState();
    const revisionFailures = [];
    const revisionCheck = (condition, message) => {
      if (!condition) { revisionFailures.push(message);console.log(`  ✗ #739: ${message}`); }
      else check(condition, message);
    };
    await verifyPreviousRelease(browser, base, pendingStorage, revisionCheck);
    await configure(page, a, REPS);
    let preview = (await read(page)).result.preview;
    check(preview.program[0].min === 6 && preview.program[0].max === 8,
      "Create custom and explicit Reps retain the imported 6-8", preview.program[0]);
    check(slots(preview)[0].prescriptionsByCycle.every(cycle => cycle.sets.every(set => set.targets.reps.min === 6 && set.targets.reps.max === 8)),
      "every set and cycle keeps the authored range");
    check(initial.importedRepRanges?.[a]?.min === 6 && initial.importedRepRanges?.[b]?.min === 10,
      "unconfigured imported ranges are keyed by slot identity");
    check(slots(initial).every(slot => !slot.metricIds.length && slot.prescriptionsByCycle.every(cycle => cycle.sets.every(set => !Object.keys(set.targets).length))),
      "pending ranges do not configure measurements or canonical targets");
    check(!Object.hasOwn(preview.importedRepRanges || {}, a) && preview.importedRepRanges?.[b]?.max === 14,
      "choosing Reps consumes only that slot's pending range");

    // Validate the actual candidate at the same public boundary used at boot and transfer.
    const validation = await page.evaluate(original => {
      const Entry = window.RepForgeProgramEntry;
      const valid = Entry.normalizeSetupDraft(original);
      const key = Object.keys(original.result.preview.importedRepRanges)[0];
      const variants = [null, [], { unknown: { min: 6, max: 8 } },
        ...[{ min: 0, max: 8 }, { min: 8, max: 6 }, { min: 6.5, max: 8 }, { min: 6, max: 1001 },
          { min: 6, max: 8, extra: true }].map(value => ({ [key]: value }))];
      const invalid = variants.map(ranges => {
        const state = structuredClone(original);state.result.preview.importedRepRanges = ranges;
        return Entry.normalizeSetupDraft(state).ok;
      });
      const otherRoute = structuredClone(original);otherRoute.route = "build";otherRoute.step = "editor";otherRoute.result.route = "build";
      delete otherRoute.result.preview.format;
      const otherRouteControl = structuredClone(otherRoute);delete otherRouteControl.result.preview.importedRepRanges;
      return { valid: valid.ok, preserved: JSON.stringify(valid.value?.result.preview.importedRepRanges) === JSON.stringify(original.result.preview.importedRepRanges),
        invalid, otherRouteControl: Entry.normalizeSetupDraft(otherRouteControl).ok, otherRoute: Entry.normalizeSetupDraft(otherRoute).ok };
    }, original);
    check(validation.valid && validation.preserved, "setup normalization preserves valid pending ranges", validation);
    check(validation.invalid.every(ok => ok === false) && validation.otherRouteControl && !validation.otherRoute,
      "malformed, unbounded, unknown-slot and unrelated-route metadata is rejected", validation);

    await page.click("#entryEditorSave");
    await page.waitForFunction(() => document.querySelector("#entryEditorStatus")?.textContent === window.RepForgeI18n.t("entry.editor.saved"));
    await resume(page);
    preview = (await read(page)).result.preview;
    check(preview.program[0].min === 6 && preview.program[0].max === 8 && preview.importedRepRanges?.[b]?.max === 14,
      "Save draft and reload retain configured targets and pending ranges separately");

    // Build a real transfer envelope from this device while setup is incomplete.
    for (const script of ["install-transfer-contract.js", "install-transfer.js"]) await page.addScriptTag({ url: new URL(script, base).href });
    const built = await page.evaluate(async () => {
      const state = JSON.parse(localStorage.getItem("repforge_v1"));
      const candidate = window.RepForgeProgramEntry.normalizeSetupDraftEnvelope(localStorage.getItem("repforge_program_setup_draft_v1")).value.envelope.state;
      const identity = JSON.parse(localStorage.getItem("repforge_telemetry_identity_v1") || "null") ||
        { schemaVersion: 1, installationId: crypto.randomUUID(), createdAt: new Date().toISOString() };
      return window.RepForgeInstallTransfer.buildEnvelope({ contract: window.RepForgeInstallTransferContract, crypto,
        source: { context: "browser", logicalInstallationId: identity.installationId, sourceRevision: state._storageRevision || 0 },
        sections: { durableState: () => window.RepForgeDurableState.exportableState(state),
          workoutDraft: { flush: window.__repforgeWorkoutDraft.flush, current: window.__repforgeWorkoutDraft.current,
            checkpoint: window.__repforgeWorkoutDraft.checkpoint, read: window.__repforgeWorkoutDraft.read,
            logicalCloneSection: draft => window.RepForgeWorkoutDraft.logicalCloneSection(draft) },
          programEntryDraft: () => candidate, uiPreferences: () => window.__repforgeUi.loadUiPrefs(), analytics: () => ({ enabled: false }), telemetryIdentity: () => identity } });
    });
    check(built.ok === true && built.value.programEntryDraft.result.preview.importedRepRanges?.[b]?.max === 14,
      "a device mid-setup builds a valid transfer without dropping pending ranges", built.code);
    const receiver = await destination.newPage();
    await receiver.goto(base);await boot(receiver);
    for (const script of ["install-transfer-contract.js", "install-transfer.js"]) await receiver.addScriptTag({ url: new URL(script, base).href });
    const imported = await importInto(receiver, built.value);
    check(imported?.ok === true, "the production install-transfer import accepts the mid-setup device", imported);
    await resume(receiver);
    check((await read(receiver)).result.preview.importedRepRanges?.[b]?.max === 14,
      "the transferred pending range survives destination reload and resume");

    for (const target of [page, receiver]) {
      await configure(target, b, REPS);
      await configure(target, time, DURATION);
      const ready = (await read(target)).result.preview;
      check(ready.program[1].min === 10 && ready.program[1].max === 14,
        "a second custom slot retains its different 10-14 range");
      check(slots(ready)[2].prescriptionsByCycle.every(cycle => cycle.sets.every(set => !Object.hasOwn(set.targets, "reps"))) &&
        !Object.hasOwn(ready.program[2], "min") && !!ready.importedRepRanges?.[time],
        "a non-repetition composition receives no repetition target and does not consume the pending range");
      await target.click("#entryEditorActivate");
      await answerEffortChoice(target);
      const active = await replicas(target);
      for (const state of [active.local, active.idb]) {
        check(state.program[0].min === 6 && state.program[0].max === 8 && state.program[1].min === 10 && state.program[1].max === 14,
          "activation writes both imported ranges to a durable replica");
        const published = await target.evaluate(state => window.RepForgeDurableState.exportableState(state), state);
        check(!JSON.stringify(published).includes("importedRepRanges"),
          "pending import metadata never enters published program, custom identities, logs, history, backup or transfer data");
      }
      check(active.setup === null, "activation removes the setup candidate and its unconsumed metadata");
      if (target === page) await verifyRecoveryExport(target, active, revisionCheck);
    }
    assert.deepEqual(revisionFailures, [], "#739 revision regressions");
    return passed;
  } finally {
    await source.close();await destination.close();
  }
}
