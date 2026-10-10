#!/usr/bin/env node
/**
 * Plan 067 P067-SHARE-VERSION: setup links carry the canonical program.
 *
 * A generated program shares as its generator request and seed and arrives
 * on a fresh device as the identical ProgramDefinition; a Build program
 * shares in full. An edited generated program that cannot fit is refused
 * whole, never truncated, and a legacy link is refused without writing
 * anything on the receiving device. A program file carries the same
 * definition through export and the file import door.
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;
// The codec carries canonical JSON (sorted keys); key order is not program meaning.
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
function firstDifference(left, right, path = "$") {
  if (same(left, right)) return null;
  if (left && right && typeof left === "object" && typeof right === "object") {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const found = firstDifference(left[key], right[key], `${path}.${key}`);
      if (found) return found;
    }
  }
  return { path, left: JSON.stringify(left)?.slice(0, 200), right: JSON.stringify(right)?.slice(0, 200) };
}
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1500)}`);
}
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());

/** Records what app.js emits through the real telemetry boundary (consent on),
 *  so the share outcomes can be checked without a network adapter. */
const RECORDER = () => {
  window.__captured = [];
  let installed;
  Object.defineProperty(window, "RepForgeTelemetry", {
    configurable: true,
    get: () => installed,
    set(next) {
      installed = next;
      try {
        next.boot({
          adapter: { capture: (name, properties) => window.__captured.push([name, { ...properties }]), setEnabled() {} },
          appVersion: "test", crypto: window.crypto, location: window.location, now: () => new Date(),
          releaseChannel: "preview", storage: window.localStorage,
        });
      } catch (error) { window.__telemetryBootError = String(error); }
    },
  });
};
// The event's own properties, without the envelope telemetry adds to every event.
const shareEvents = (page) => page.evaluate(() => window.__captured
  .filter(([name]) => name === "share_setup_outcome")
  .map(([, { action, program_kind, form, size_vs_limit }]) => ({ action, program_kind, form, size_vs_limit })));

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.addInitScript(RECORDER);
  await context.addInitScript(() => window.localStorage.setItem("repforge_telemetry_enabled_v1", "true"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function activateGenerated(page, { edit = false } = {}) {
  return page.evaluate(async ({ edit }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog);
    const definition = window.RepForgeProgramCompiler.generateProgram(mapped.value, catalog, "share-journey").value;
    if (edit) definition.days.find((day) => day.kind === "training").slots[0].setupNotes = "Rack at 7";
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Shared generated block", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "share-journey" },
    });
    await window.__repforgeStorage.flush();
    return !!(result?.localOk || result?.idbOk);
  }, { edit });
}

async function shareLink(page) {
  await page.locator('nav button[data-view="program"]').click();
  await page.waitForSelector("#program.view.active");
  await page.locator("#shareProgramSetup").click();
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 15000 });
  await page.waitForFunction(() => {
    const status = document.querySelector("#shareSetupStatus");
    const link = document.querySelector("#shareSetupLink");
    const value = link && ("value" in link ? link.value : link.textContent);
    return !!value || (status && !status.classList.contains("hidden") && !/building|preparing/i.test(status.textContent || ""));
  }, undefined, { timeout: 20000 });
  return page.evaluate(() => {
    const link = document.querySelector("#shareSetupLink");
    return { link: link && ("value" in link ? link.value : link.textContent), status: document.querySelector("#shareSetupStatus")?.textContent?.trim() || "" };
  });
}

async function receive(browser, link) {
  const run = await fresh(browser);
  await run.page.goto(link, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(run.page, { base: BASE });
  return run;
}

async function startAndActivate(page) {
  await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 15000 });
  const cap = await page.locator("#firstRunSharedCap").innerText();
  await page.locator("#firstRunSharedStart").click();
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
  await page.locator("#entryActivate").click();
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  return cap;
}

async function main() {
  console.log("P067 setup links: share and receive the canonical program");
  const browser = await launchChromium();
  const errors = [];
  try {
    // A generated program travels by request and seed --------------------
    const sender = await fresh(browser);
    errors.push(sender.errors);
    check(await activateGenerated(sender.page), "the sender has a generated program active");
    const sent = (await state(sender.page)).programMeta.programDefinition;
    const generated = await shareLink(sender.page);
    const encoded = generated.link?.split("#setup=")[1] || "";
    check(generated.link && encoded.startsWith("v4.") && encoded.length <= 3072,
      "a generated seven-cycle program shares within the link limit", { length: encoded.length, status: generated.status });
    check(same(await shareEvents(sender.page), [{ action: "link_ready", program_kind: "generated", form: "recipe", size_vs_limit: "under_half" }]),
      "a ready recipe link reports its kind, form and size against the limit", await shareEvents(sender.page));
    const receiver = await receive(browser, generated.link);
    errors.push(receiver.errors);
    const cap = await startAndActivate(receiver.page);
    check(/Shared generated block/.test(cap) && /4/.test(cap), "the receiver's first run names the shared program and its days", cap);
    const received = (await state(receiver.page)).programMeta;
    check(same(received.programDefinition, sent),
      "the receiver activates the identical ProgramDefinition", firstDifference(sent, received.programDefinition));
    check(received.name === "Shared generated block", "the shared name is kept");
    await receiver.context.close();
    await sender.context.close();

    // A program file carries the same definition -------------------------------
    const exporter = await fresh(browser);
    errors.push(exporter.errors);
    await activateGenerated(exporter.page);
    const exported = (await state(exporter.page)).programMeta.programDefinition;
    await exporter.page.locator('nav button[data-view="program"]').click();
    await exporter.page.click("#programEditToggle");
    await exporter.page.waitForSelector("#programEditorWrap:not(.is-hidden)");
    await exporter.page.locator("#programEditorWrap details.advanced > summary").click();
    const [download] = await Promise.all([exporter.page.waitForEvent("download"), exporter.page.locator("#exportProgram").click()]);
    const fileText = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
    const file = JSON.parse(fileText);
    check(file.kind === "taurifer-program" && file.version === 4 && same(file.definition, exported),
      "the program file is the canonical definition");
    // The raw JSON editor edits the definition itself.
    const raw = JSON.parse(await exporter.page.locator("#programJson").inputValue());
    check(same(raw, exported), "the raw editor shows the canonical definition");
    const firstSlot = raw.days.find((day) => day.kind === "training").slots[0];
    firstSlot.setupNotes = "Seat 4";
    firstSlot.prescriptionsByCycle[0].sets[0].targets.reps = { min: 6, max: 8 };
    await exporter.page.locator("#programJson").fill(JSON.stringify(raw));
    await exporter.page.click("#saveProgram");
    await exporter.page.waitForFunction((slotId) => window.__repforgeWorkoutDraft.state().programMeta.programDefinition
      .days.flatMap((day) => day.slots).find((slot) => slot.id === slotId)?.setupNotes === "Seat 4", firstSlot.id, { timeout: 15000 });
    const savedRaw = await state(exporter.page);
    const row = savedRaw.program.find((entry) => (entry.slotId || entry.id) === firstSlot.id);
    check(row?.min === 6 && row?.max === 8, "saved raw JSON re-projects the program rows from the definition", row);
    const broken = structuredClone(raw);
    broken.days.find((day) => day.kind === "training").slots[0].exerciseId = "not-a-catalog-movement";
    await exporter.page.locator("#programJson").fill(JSON.stringify(broken));
    await exporter.page.click("#saveProgram");
    await exporter.page.waitForFunction(() => /isn't valid|não é válida/.test(document.querySelector("#toast")?.textContent || ""), undefined, { timeout: 10000 });
    check(same((await state(exporter.page)).programMeta.programDefinition, savedRaw.programMeta.programDefinition),
      "an invalid definition is refused and nothing is saved");
    await exporter.context.close();
    const importer = await fresh(browser);
    errors.push(importer.errors);
    await importer.page.click("#firstRunImport");
    await importer.page.waitForSelector("#importProgram", { state: "attached" });
    await importer.page.setInputFiles("#importProgram", { name: "program.json", mimeType: "application/json", buffer: Buffer.from(fileText) });
    await importer.page.waitForSelector("#importReview.active", { timeout: 15000 });
    await importer.page.click("#importCommit");
    await importer.page.waitForSelector("#entryActivate", { timeout: 15000 });
    await importer.page.click("#entryActivate");
    await importer.page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
    check(same((await state(importer.page)).programMeta.programDefinition, exported),
      "importing the file activates the identical definition", firstDifference(exported, (await state(importer.page)).programMeta.programDefinition));
    await importer.context.close();

    // A Build program travels in full ---------------------------------------
    const builder = await fresh(browser);
    errors.push(builder.errors);
    await installSeedProgram(builder.page, { waitFor: (page) => waitForAppBoot(page, { base: BASE }) });
    const built = (await state(builder.page)).programMeta.programDefinition;
    const manual = await shareLink(builder.page);
    check(manual.link && manual.link.split("#setup=")[1].length <= 3072, "a Build program shares in full within the limit",
      { length: manual.link?.split("#setup=")[1]?.length, status: manual.status });
    const manualEvents = await shareEvents(builder.page);
    check(manualEvents.length === 1 && manualEvents[0].action === "link_ready" && manualEvents[0].program_kind === "manual" &&
      manualEvents[0].form === "full" && ["under_half", "under_limit"].includes(manualEvents[0].size_vs_limit),
      "a ready full link reports a manual program and its size", manualEvents);
    const manualReceiver = await receive(browser, manual.link);
    errors.push(manualReceiver.errors);
    await startAndActivate(manualReceiver.page);
    check(same((await state(manualReceiver.page)).programMeta.programDefinition, built),
      "the Build program arrives unchanged", firstDifference(built, (await state(manualReceiver.page)).programMeta.programDefinition));
    await manualReceiver.context.close();
    await builder.context.close();

    // #317: a slot's alternates travel by link and by file --------------------
    // One catalog alternate and one custom movement that is only an alternate,
    // so the custom definition has to travel on the strength of the alternate.
    const alternating = await fresh(browser);
    errors.push(alternating.errors);
    await installSeedProgram(alternating.page, { waitFor: (page) => waitForAppBoot(page, { base: BASE }) });
    const CUSTOM_ALTERNATE = { id: "custom:alt-landmine", name: "Coach landmine press", equipment: [],
      primary: "", secondary: "", notes: "", metricIds: [], metricDefinitions: [] };
    await alternating.page.evaluate(async (custom) => {
      await window.__repforgeStorage.flush();
      const state = JSON.parse(localStorage.getItem("repforge_v1"));
      const slots = state.programMeta.programDefinition.days.flatMap((day) => day.slots);
      slots[0].alternates = [slots[1].exerciseId, custom.id];
      state.customExercises = [...(state.customExercises || []), custom];
      localStorage.setItem("repforge_v1", JSON.stringify(state));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(state, "repforge_v1");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, CUSTOM_ALTERNATE);
    await alternating.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(alternating.page, { base: BASE });
    const withAlternates = (await state(alternating.page)).programMeta.programDefinition;
    const firstAlternates = (definition) => definition?.days.flatMap((day) => day.slots)[0]?.alternates;
    check(firstAlternates(withAlternates)?.[1] === CUSTOM_ALTERNATE.id, "the sender's slot carries a catalog and a custom alternate",
      firstAlternates(withAlternates));
    const alternateLink = await shareLink(alternating.page);
    check(alternateLink.link && alternateLink.link.split("#setup=")[1].length <= 3072,
      "a program with alternates shares in full within the limit", { length: alternateLink.link?.split("#setup=")[1]?.length, status: alternateLink.status });
    const alternateReceiver = await receive(browser, alternateLink.link);
    errors.push(alternateReceiver.errors);
    await startAndActivate(alternateReceiver.page);
    const receivedAlternates = await state(alternateReceiver.page);
    check(same(receivedAlternates.programMeta.programDefinition, withAlternates),
      "the link delivers the alternates unchanged", firstDifference(withAlternates, receivedAlternates.programMeta.programDefinition));
    check((receivedAlternates.customExercises || []).some((entry) => entry.id === CUSTOM_ALTERNATE.id && entry.name === CUSTOM_ALTERNATE.name),
      "the custom movement that is only an alternate arrives with it", receivedAlternates.customExercises);
    await alternateReceiver.context.close();
    await alternating.page.keyboard.press("Escape");
    await alternating.page.waitForSelector("#shareSetupSheet", { state: "hidden" });
    await alternating.page.click("#programEditToggle");
    await alternating.page.waitForSelector("#programEditorWrap:not(.is-hidden)");
    await alternating.page.locator("#programEditorWrap details.advanced > summary").click();
    const [alternateDownload] = await Promise.all([alternating.page.waitForEvent("download"), alternating.page.locator("#exportProgram").click()]);
    const alternateFile = await (await import("node:fs/promises")).readFile(await alternateDownload.path(), "utf8");
    const alternateJson = JSON.parse(alternateFile);
    check(same(alternateJson.definition, withAlternates) && alternateJson.customExercises.some((entry) => entry.id === CUSTOM_ALTERNATE.id),
      "the program file carries the alternates and the custom movement they name", { custom: alternateJson.customExercises?.map((entry) => entry.id) });
    await alternating.context.close();
    const alternateImporter = await fresh(browser);
    errors.push(alternateImporter.errors);
    await alternateImporter.page.click("#firstRunImport");
    await alternateImporter.page.waitForSelector("#importProgram", { state: "attached" });
    await alternateImporter.page.setInputFiles("#importProgram", { name: "program.json", mimeType: "application/json", buffer: Buffer.from(alternateFile) });
    await alternateImporter.page.waitForSelector("#importReview.active", { timeout: 15000 });
    await alternateImporter.page.click("#importCommit");
    await alternateImporter.page.waitForSelector("#entryActivate", { timeout: 15000 });
    await alternateImporter.page.click("#entryActivate");
    await alternateImporter.page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
    const importedAlternates = await state(alternateImporter.page);
    check(same(importedAlternates.programMeta.programDefinition, withAlternates),
      "importing the file activates the alternates unchanged", firstDifference(withAlternates, importedAlternates.programMeta.programDefinition));
    check((importedAlternates.customExercises || []).some((entry) => entry.id === CUSTOM_ALTERNATE.id),
      "the imported program keeps the custom alternate's definition", importedAlternates.customExercises?.map((entry) => entry.id));
    await alternateImporter.context.close();

    // An edited generated program that cannot fit is refused whole -------------
    const edited = await fresh(browser);
    errors.push(edited.errors);
    await activateGenerated(edited.page, { edit: true });
    const tooLarge = await shareLink(edited.page);
    check(!tooLarge.link && /too large|too long|grande|longo/i.test(tooLarge.status),
      "an edited generated program too large for a link is refused, not truncated", tooLarge);
    const offered = await edited.page.evaluate(() => ({
      file: !!document.querySelector("#shareSetupFile:not(.hidden):not([disabled])"),
      copy: !document.querySelector("#shareSetupCopy")?.classList.contains("hidden"),
      share: !document.querySelector("#shareSetupShare")?.classList.contains("hidden"),
      linkIntro: !document.querySelector("#shareSetupBody")?.classList.contains("hidden"),
      status: document.querySelector("#shareSetupStatus")?.textContent?.trim() || "",
    }));
    check(offered.file && !offered.copy && !offered.share && !offered.linkIntro && /file|arquivo/i.test(offered.status),
      "a refused link offers the program as a file instead, and no link actions or link instructions", offered);
    const refusedEvents = await shareEvents(edited.page);
    check(refusedEvents.length === 1 && refusedEvents[0].action === "link_refused" && refusedEvents[0].program_kind === "generated_edited" &&
      refusedEvents[0].form === "full" && ["over_2x", "over_4x"].includes(refusedEvents[0].size_vs_limit),
      "a refused link reports an edited generated program and how far over the limit it is", refusedEvents);
    const editedDefinition = (await state(edited.page)).programMeta.programDefinition;
    if (offered.file) {
      const [fileDownload] = await Promise.all([edited.page.waitForEvent("download"), edited.page.locator("#shareSetupFile").click()]);
      const sharedFile = JSON.parse(await (await import("node:fs/promises")).readFile(await fileDownload.path(), "utf8"));
      check(sharedFile.kind === "taurifer-program" && sharedFile.version === 4 && same(sharedFile.definition, editedDefinition),
        "the shared file carries the edited program's canonical definition", firstDifference(editedDefinition, sharedFile.definition));
      const fileEvents = await shareEvents(edited.page);
      check(fileEvents.at(-1)?.action === "file_shared" && fileEvents.at(-1)?.program_kind === "generated_edited",
        "sharing the file is reported as the fallback taken", fileEvents);
      const recipient = await fresh(browser);
      errors.push(recipient.errors);
      const imported = await recipient.page.evaluate((text) => window.__repforgeParseProgramSource(text, "program.json"), JSON.stringify(sharedFile));
      check(same(imported?.definition, editedDefinition),
        "another device's Import reads the shared file back as the same program", firstDifference(editedDefinition, imported?.definition));
      await recipient.context.close();
    }
    await edited.context.close();

    // A legacy link is refused and writes nothing ------------------------------
    const legacy = await fresh(browser);
    errors.push(legacy.errors);
    const before = await legacy.page.evaluate(() => localStorage.getItem("repforge_v1"));
    await legacy.page.goto(`${BASE}#setup=v3.H4sIAAAAAAAAA6tWKkktLlGyUlAqS8wpTVWqBQDEn8qkEQAAAA`, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(legacy.page, { base: BASE });
    const refused = await legacy.page.evaluate(() => ({ status: window.__repforgeSharedSetup.status,
      error: document.querySelector("#firstRunSharedError")?.textContent?.trim() || "",
      stored: localStorage.getItem("repforge_v1") }));
    check(refused.status === "unsupported" || refused.status === "invalid", "a legacy setup link is refused", refused.status);
    check(!!refused.error && JSON.parse(refused.stored || "{}")?.programMeta?.onboarded !== true,
      "the refusal is explained and no program is written", { error: refused.error, before: !!before });
    await legacy.context.close();

    check(errors.flat().length === 0, "no page errors while sharing", errors.flat());
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    await browser.close();
  }
  console.log(`\nP067 share result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
