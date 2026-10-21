#!/usr/bin/env node
/**
 * P069-S4-SHARE: a Build program's Suggest loads opt-in travels through the
 * setup link and a raw backup, and nothing else about sharing changes.
 *
 * A two-day Build program opts in its bench press and a dumbbell renegade row,
 * which answers the execution-mode question. The app's own Share sheet makes
 * the link; the same codec measures it against the link with the opt-in
 * reverted, and both sizes are printed against the 3,072-character limit. A
 * fresh device starts it through first run with every status, RIR, execution
 * mode and provenance intact. A backup restores them too; the same backup with
 * the opt-in removed (a Build program from before 069) restores manual.
 *
 * A representative three-day, twelve-slot Build program is measured the same
 * way. Its link does not fit with or without the opt-in, so the Share sheet
 * refuses it whole and offers Share as file.
 *
 * Run: node tools/run-tests.mjs entry --suite-id test-adaptive-build-share-mjs
 */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { BENCH_ID, BENCH_NAME, buildRepresentativeProgram } from "./adaptive-build-fixture.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const LIMIT = 3072;
const RENEGADE_ROW = ["3065c6f170d880d2bc77cba9edbf8ce9", "Dumbbell renegade row"];
const SMALL_DAYS = [[[BENCH_ID, BENCH_NAME]], [RENEGADE_ROW]];
const DAYS = [
  [[BENCH_ID, BENCH_NAME], ["1a25c6f170d8803d8231d083fdd65458", "Barbell back squat"],
    ["1a15c6f170d880f89beacd8c81156f2d", "Bent-over barbell row"], ["1a15c6f170d880479d38c49a76cb6b10", "Cable rope triceps pushdown"]],
  [RENEGADE_ROW, ["1a25c6f170d880c59f17ce7802758fc3", "Leg extension"],
    ["1a35c6f170d8800bab2dca0110e26c4a", "Lying hamstring curl"], ["1a15c6f170d8800d8fc9d2c235673bf6", "Overhand grip cable lat pulldown"]],
  [["1a05c6f170d880198e1aceac084f30eb", "45° incline barbell press"], ["1a15c6f170d880ee83eccf109356e208", "Barbell biceps curl"],
    ["1a35c6f170d88059b804ff16ff621a1c", "Barbell hip thrust"], ["1a35c6f170d8801e907be574e89e5c65", "Seated machine hip abduction"]],
];
const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail).slice(0, 3000)}`);
}
const canonical = (value) => JSON.stringify(value, (key, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map((name) => [name, entry[name]])) : entry);

/** The opt-in facts of every slot: what has to survive each round trip. */
function optInFacts(definition) {
  return (definition?.days || []).flatMap((day) => (day.slots || []).map((slot) => ({
    exerciseId: slot.exerciseId,
    executionMode: slot.executionMode ?? null,
    sets: (slot.prescriptionsByCycle || []).flatMap((cycle) => cycle.sets.map((set) => [set.status, set.rir, set.provenance?.source, set.provenance?.policyVersion])),
  })));
}
const codecOptions = () => ({
  catalogSnapshot: window.__repforgeTrainingTest.catalog,
  validateProgramDefinition: window.__repforgeTrainingTest.compiler.validateProgramDefinition,
  generateProgram: window.__repforgeTrainingTest.compiler.generateProgram,
  generatorVersion: window.__repforgeTrainingTest.compiler.GENERATOR_VERSION,
});
const decodeIn = (page, encoded) => page.evaluate(async ({ encoded, options }) =>
  window.RepForgeSharedSetup.decode(encoded, new Function(`return (${options})()`)()), { encoded, options: codecOptions.toString() });
const encodeIn = (page, document) => page.evaluate(async ({ document, options }) =>
  window.RepForgeSharedSetup.encode(document, new Function(`return (${options})()`)()), { document, options: codecOptions.toString() });

/** The app's own validated payload, encoded; `revert` removes the opt-in first. */
const measureLink = (page, revert, perDay = Infinity) => page.evaluate(async ({ options, revert, perDay }) => {
  const built = window.__repforgeSharedSetup.buildValidation();
  const opts = new Function(`return (${options})()`)();
  const checked = window.RepForgeSharedSetup.validate(built.payload, { ...opts, diagnostics: built.diagnostics });
  if (!checked.ok) return { ok: false, code: checked.code, chars: null };
  const document = JSON.parse(JSON.stringify(checked.value));
  for (const day of document.program.definition.days || []) if (day.slots) day.slots = day.slots.slice(0, perDay);
  if (revert) for (const day of document.program.definition.days || []) for (const slot of day.slots || []) {
    delete slot.executionMode;
    for (const cycle of slot.prescriptionsByCycle || []) for (const set of cycle.sets || []) {
      set.status = "manual"; set.rir = null; set.provenance = { ...set.provenance, source: "manual", policyVersion: "manual@1" };
    }
  }
  const encoded = await window.RepForgeSharedSetup.encode(document, opts);
  return { ok: encoded.ok, code: encoded.code ?? null, chars: encoded.encodedChars ?? encoded.value?.length ?? null };
}, { options: codecOptions.toString(), revert, perDay: Number.isFinite(perDay) ? perDay : 99 });

async function openShareSheet(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  await page.click("#shareProgramSetup");
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 10000 });
  await page.waitForFunction(() => {
    const copy = document.querySelector("#shareSetupCopy"), status = document.querySelector("#shareSetupStatus");
    return (copy && !copy.disabled) || (status && !status.classList.contains("hidden") && !/preparing|preparando/i.test(status.textContent || ""));
  }, null, { timeout: 15000 });
  return page.evaluate(() => {
    const visible = (node) => !!node && !node.disabled && !node.classList.contains("hidden") && !node.closest(".hidden,[hidden]");
    const link = document.querySelector("#shareSetupLink");
    return {
      link: ((link && ("value" in link ? link.value : link.textContent)) || "").trim(),
      status: (document.querySelector("#shareSetupStatus")?.textContent || "").trim(),
      copy: visible(document.querySelector("#shareSetupCopy")),
      file: visible(document.querySelector("#shareSetupFile")),
    };
  });
}

async function exportBackup(page) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.locator("#exportJson").click()]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function importBackup(page, backup) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({ name: "p069-s4-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === true ||
    !document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 15000 });
  if (!await page.evaluate(() => document.querySelector("#importChoice")?.open === true))
    throw new Error(`The backup importer refused the file: ${await page.locator("#toast").innerText()}`);
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

const durableDefinition = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null")?.programMeta?.programDefinition, KEY);

const browser = await launchChromium();
const contexts = [];
try {
  const sender = await freshPage(browser);
  contexts.push(sender.context);
  const pageErrors = [];
  sender.page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  await buildRepresentativeProgram(sender.page, { name: "Shared Build", days: SMALL_DAYS, rir: 2, modes: { [RENEGADE_ROW[0]]: "unilateral" } });
  const sent = await durableDefinition(sender.page);
  const sentFacts = optInFacts(sent);
  const renegade = sentFacts.find((entry) => entry.exerciseId === RENEGADE_ROW[0]);
  check(sentFacts.length === 2 && sentFacts.every((entry) => entry.sets.every(([status, rir, source, policy]) =>
    status === "ready" && rir === 2 && source === "manual" && policy === "manual-adaptive@1")) && renegade?.executionMode === "unilateral",
  "both Build slots are opted in, the renegade row with its chosen execution mode", sentFacts.map((entry) => [entry.exerciseId, entry.executionMode]));

  // The link, from the app's own Share sheet, and its size without the opt-in.
  const share = await openShareSheet(sender.page);
  const fragment = share.link ? new URL(share.link).hash.replace(/^#setup=/, "") : "";
  const decoded = fragment ? await decodeIn(sender.page, fragment) : null;
  const before = await measureLink(sender.page, true);
  console.log(`  Two-slot Build link: ${before.chars ?? before.code} characters without the opt-in, ${fragment.length} with it, limit ${LIMIT}.`);
  check(!!fragment && fragment.length <= LIMIT && decoded?.ok === true,
    "the Share sheet produces a decodable link within the limit", { length: fragment.length, status: share.status, code: decoded?.code });
  check(before.ok && before.chars < fragment.length, "the opt-in makes the link larger", { before, after: fragment.length });
  check(canonical(optInFacts(decoded?.value?.program?.definition)) === canonical(sentFacts),
    "the link carries every status, RIR, execution mode and provenance of the opt-in");
  check(canonical(Object.keys(decoded?.value || {}).sort()) === canonical(["kind", "language", "program", "settings", "version"])
    && canonical(Object.keys(decoded?.value?.program || {}).sort()) === canonical(["definition", "name"])
    && !JSON.stringify(decoded?.value || {}).includes("loadStepKg") && !JSON.stringify(decoded?.value || {}).includes("suggestLoads"),
  "the link keeps its allowlist: no per-exercise loading override and no pending opt-in", Object.keys(decoded?.value || {}));
  await sender.page.click("#shareSetupClose");
  await sender.page.locator("#shareSetupSheet").waitFor({ state: "hidden" });

  // A fresh device starts the shared program through first run.
  const receiver = await freshPage(browser);
  contexts.push(receiver.context);
  await receiver.page.goto(`${new URL("index.html", BASE).href}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(receiver.page, { base: BASE });
  await receiver.page.locator("#firstRunSharedStart").click({ timeout: 15000 });
  await receiver.page.waitForSelector("#entryActivate", { timeout: 10000 });
  await receiver.page.click("#entryActivate");
  await receiver.page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "null")?.programMeta?.onboarded === true, KEY, { timeout: 15000 });
  await receiver.page.evaluate(() => window.__repforgeStorage.flush());
  const received = await durableDefinition(receiver.page);
  check(canonical(optInFacts(received)) === canonical(sentFacts),
    "first-run activation of the link keeps every status, RIR, execution mode and provenance", optInFacts(received));

  // Backup round trip, and a pre-069 Build backup.
  const backup = await exportBackup(sender.page);
  check(canonical(optInFacts(backup.programMeta?.programDefinition)) === canonical(sentFacts), "the backup export holds the opt-in");
  const restoredTarget = await freshPage(browser);
  contexts.push(restoredTarget.context);
  await importBackup(restoredTarget.page, backup);
  check(canonical(optInFacts(await durableDefinition(restoredTarget.page))) === canonical(sentFacts),
    "a restored backup keeps every opt-in");
  const legacy = JSON.parse(JSON.stringify(backup));
  for (const day of legacy.programMeta.programDefinition.days) for (const slot of day.slots || []) {
    delete slot.executionMode;
    for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
      set.status = "manual"; set.rir = null; set.provenance = { ...set.provenance, source: "manual", policyVersion: "manual@1" };
    }
  }
  const legacyTarget = await freshPage(browser);
  contexts.push(legacyTarget.context);
  await importBackup(legacyTarget.page, legacy);
  const legacyFacts = optInFacts(await durableDefinition(legacyTarget.page));
  const legacyRow = await legacyTarget.page.evaluate((id) => {
    const row = JSON.parse(localStorage.getItem("repforge_v1") || "null").program.find((entry) => entry.libraryId === id);
    const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(row.id));
    return { status: rec?.status, load: rec?.load ?? null };
  }, BENCH_ID);
  check(legacyFacts.length === 2 && legacyFacts.every((entry) => entry.sets.every(([status]) => status === "manual"))
    && legacyRow.status === "manual" && legacyRow.load == null,
  "a Build backup from before 069 restores manual and suggests nothing", legacyRow);
  check(pageErrors.length === 0, "the sender has no uncaught browser errors", pageErrors);

  // A representative twelve-slot Build program does not fit a link.
  const large = await freshPage(browser);
  contexts.push(large.context);
  await buildRepresentativeProgram(large.page, { name: "Representative Build", days: DAYS, rir: 2, modes: { [RENEGADE_ROW[0]]: "unilateral" } });
  const largeAfter = await measureLink(large.page, false), largeBefore = await measureLink(large.page, true);
  console.log(`  Representative Build link (3 days × 4 slots): ${largeBefore.code} without the opt-in, ${largeAfter.code} with it ` +
    `(the codec stops once the compressed program passes the ${LIMIT}-character bound).`);
  const refused = await openShareSheet(large.page);
  check(largeBefore.code === "encoded-too-large" && largeAfter.code === "encoded-too-large",
    "the representative program is over the link limit with and without the opt-in", { largeBefore, largeAfter });
  check(refused.link === "" && !refused.copy && refused.file && /too large/i.test(refused.status),
    "its link is refused whole, with Share as file offered and no truncated link", refused);
} catch (error) {
  failures.push(String(error?.stack || error));
  console.error(error?.stack || error);
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
}

console.log(`\nP069-S4-SHARE: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
