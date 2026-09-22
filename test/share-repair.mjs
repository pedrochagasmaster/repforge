#!/usr/bin/env node
/**
 * Plan 057-P3: Share blocker identity and explicit repair.
 *
 * This suite keeps the validator as the oracle for the rendered blocker list,
 * then drives built-in, custom, cancel, and stale-target repair through the
 * installed editor. A browser result is not accepted from one replica alone.
 */
import { pathToFileURL } from "url";
import { readFileSync } from "fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { BUILT_IN_IDS, CURRENT_SETTINGS_DEFAULTS, KIND, VERSION } from "./fixtures/shared-setup.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const INDEX = new URL("index.html", BASE).href;
const KEY = "repforge_v1";
let passed = 0;
let failed = 0;

function assert(condition, name, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${detail}`);
  }
}

function seedState() {
  return {
    settings: { ...CURRENT_SETTINGS_DEFAULTS, lang: "en", unit: "kg", rirMode: "numeric" },
    programMeta: {
      id: "prog-share-repair",
      name: "Repairable split",
      started: "2026-01-01",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 1,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "normal",
      completedAt: null,
    },
    program: [
      { id: "ex-missing", name: "Unlinked press", day: "Day 1", order: 1, sets: 3, min: 8, max: 12, primary: "Chest", secondary: "", libraryId: "" },
      { id: "ex-unknown", name: "Former press", day: "Day 1", order: 2, sets: 3, min: 8, max: 12, primary: "Chest", secondary: "", libraryId: "gone:press" },
      { id: "ex-custom", name: "Coach row", day: "Day 1", order: 3, sets: 3, min: 8, max: 12, primary: "Mid/upper back", secondary: "Biceps", libraryId: "custom:missing" },
    ],
    log: [],
    programHistory: [],
    customExercises: [],
    _storageRevision: 4,
  };
}

async function clearSite(page) {
  await page.evaluate(async (key) => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, KEY);
}

async function writeBoth(page, value) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, value });
}

async function readDurable(page) {
  return page.evaluate(async (key) => {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    let idb = null;
    if (db) {
      idb = await new Promise((resolve) => {
        const tx = db.transaction("kv", "readonly");
        const request = tx.objectStore("kv").get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      db.close();
    }
    return { local, idb };
  }, KEY);
}

async function openSeed(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(INDEX, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await clearSite(page);
  await writeBoth(page, seedState());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.locator('nav button[data-view="program"]').click();
  await page.waitForSelector("#program.view.active");
  await page.locator("#shareProgramSetup").click();
  await page.waitForSelector("#shareSetupBlockers:not(.hidden)");
  return { context, page };
}

async function waitForShare(page, { allowReady = false } = {}) {
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 15000 });
  await page.waitForFunction((ready) => {
    const list = document.querySelector("#shareSetupBlockers");
    return list && (!list.classList.contains("hidden") || (ready && !document.querySelector("#shareSetupCopy")?.classList.contains("hidden")));
  }, allowReady, { timeout: 15000 });
}

async function clickRepair(page, id) {
  await page.locator(`[data-share-repair="${id}"]`).click();
  await page.waitForSelector("#exPickSheet:not(.hidden)", { timeout: 10000 });
}

async function shareFocus(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id || "",
    repair: document.activeElement?.getAttribute("data-share-repair") || "",
    role: document.activeElement?.getAttribute("role") || "",
  }));
}

async function run() {
  const browser = await launchChromium();
  try {
    const english = JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8"));
    const portuguese = JSON.parse(readFileSync(new URL("../i18n-pt.json", import.meta.url), "utf8"));
    assert(!Object.prototype.hasOwnProperty.call(english, "program.share_setup_unlinked") &&
      !Object.prototype.hasOwnProperty.call(portuguese, "program.share_setup_unlinked"),
      "Share catalogs carry no retired disclosure copy");
    console.log("validator contract");
    const validator = await (async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(INDEX, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      const result = await page.evaluate(async ({ kind, version, ids }) => {
        const payload = {
          kind,
          version,
          program: {
            meta: {
              name: "Blockers",
              daysPerWeek: 1,
              mesocycleLengthWeeks: 6,
              programStructure: { schemaVersion: 1, days: [{ dayId: "push_d1", label: "Day 1", order: 1 }] },
            },
            exercises: [
              { id: "slot-a", day: "Day 1", order: 1, sets: 3, min: 8, max: 12, libraryId: "", displayName: "No link" },
              { id: "slot-b", day: "Day 1", order: 2, sets: 3, min: 8, max: 12, libraryId: "gone:press", displayName: "Gone press" },
              { id: "slot-c", day: "Day 1", order: 3, sets: 3, min: 8, max: 12, libraryId: "custom:gone", displayName: "Missing custom" },
              { id: "slot-d", day: "Day 1", order: 4, sets: 3, min: 8, max: 12, libraryId: "pr_mc", displayName: "Known press" },
            ],
            customExercises: [],
          },
          settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric" },
        };
        const diagnostics = { "slot-a": { displayName: "No link", equipment: ["cables"], primary: "Chest" } };
        const options = { builtInIds: new Set(ids), diagnostics };
        const checked = window.RepForgeSharedSetup.validate(payload, options);
        const withSchemaIssue = window.RepForgeSharedSetup.validate({ ...payload, settings: { ...payload.settings, lang: "fr" } }, options);
        const valid = window.RepForgeSharedSetup.validate({
          ...payload,
          program: { ...payload.program, exercises: [payload.program.exercises[3]] },
        }, options);
        const largeExercises = Array.from({ length: 40 }, (_, index) => ({
          ...payload.program.exercises[3],
          id: `large-${index}`,
          order: index + 1,
          notes: Array.from({ length: 1800 }, (_, offset) => String.fromCharCode(0x2500 + ((offset + index * 13) % 80))).join(""),
        }));
        const largePayload = { ...payload, program: { ...payload.program, exercises: largeExercises, meta: { ...payload.program.meta, daysPerWeek: 1 } } };
        const largeChecked = window.RepForgeSharedSetup.validate(largePayload, options);
        const largeEncoded = largeChecked.ok ? await window.RepForgeSharedSetup.encode(largeChecked.value, { builtInIds: new Set(ids) }) : largeChecked;
        return { checked, withSchemaIssue, valid, largeChecked, largeEncoded };
      }, { kind: KIND, version: VERSION, ids: [...BUILT_IN_IDS] });
      await context.close();
      return result;
    })();
    const reasons = validator.checked.blockers?.map((item) => item.reasonCode).join(",") || "";
    assert(validator.checked.code === "unresolved-exercises" && reasons === "missing-library-id,unknown-library-id,missing-custom-definition", "validator emits one ordered blocker per unresolved row", JSON.stringify(validator.checked));
    assert(validator.checked.blockers?.[0]?.dayId === "push_d1" && validator.checked.blockers?.[0]?.known?.equipment?.[0] === "cables", "blocker uses stable day identity and only supplied known facts", JSON.stringify(validator.checked.blockers?.[0]));
    assert(validator.withSchemaIssue.code === "invalid-schema" && validator.withSchemaIssue.blockers?.length === 3, "other schema issues retain their code alongside blockers", JSON.stringify(validator.withSchemaIssue));
    assert(validator.valid.ok === true && Array.isArray(validator.valid.blockers) && validator.valid.blockers.length === 0 && !("id" in validator.valid.value.program.exercises[0]), "success returns blockers:[] and strips diagnostic identity from the canonical value", JSON.stringify(validator.valid));
    assert(validator.largeChecked.ok === true && validator.largeChecked.value.program.exercises.every((row) => row.notes.length === 1800) &&
      validator.largeEncoded.ok === false && ["decompressed-too-large", "encoded-too-large"].includes(validator.largeEncoded.code),
      "oversized notes fail closed without truncation", JSON.stringify({ checked: validator.largeChecked, encoded: validator.largeEncoded }));

    const { context, page } = await openSeed(browser);
    try {
      const rendered = await page.evaluate(() => {
        const built = window.__repforgeSharedSetup.buildValidation();
        const payload = built.payload;
        const checked = window.RepForgeSharedSetup.validate(payload, {
          builtInIds: new Set(window.RepForgeExercises.library.map((entry) => entry.id)),
          diagnostics: built.diagnostics,
        });
        const dom = [...document.querySelectorAll("#shareSetupBlockers [data-share-blocker-id]")].map((node) => ({
          id: node.dataset.shareBlockerId,
          dayId: node.dataset.shareDayId,
          reasonCode: node.dataset.shareReason,
          displayName: node.querySelector("strong")?.textContent || "",
        }));
        return {
          checked: checked.blockers,
          dom,
          canonicalHasDiagnostics: Object.keys(checked.value?.program?.exercises?.[0] || {}).some((key) => key.includes("diagnostic")),
          copyVisible: !document.querySelector("#shareSetupCopy")?.classList.contains("hidden"),
          shareVisible: !document.querySelector("#shareSetupShare")?.classList.contains("hidden"),
          copyDisabled: !!document.querySelector("#shareSetupCopy")?.disabled,
          shareDisabled: !!document.querySelector("#shareSetupShare")?.disabled,
          repairNames: [...document.querySelectorAll("#shareSetupBlockers [data-share-repair]")].map((node) => node.getAttribute("aria-label") || node.textContent.trim()),
          shareText: (document.querySelector("#shareSetupSheet")?.textContent || "").toLowerCase(),
        };
      });
      const sameBlockers = JSON.stringify((rendered.checked || []).map((row) => ({
        id: row.exerciseInstanceId,
        dayId: row.dayId,
        reasonCode: row.reasonCode,
        displayName: row.displayName,
      }))) === JSON.stringify(rendered.dom);
      assert(sameBlockers, "rendered blocker list equals validator output one-to-one", JSON.stringify(rendered));
      assert(!rendered.copyVisible && !rendered.shareVisible && rendered.copyDisabled && rendered.shareDisabled && !rendered.canonicalHasDiagnostics, "Share fails closed and diagnostics stay out of the canonical payload", JSON.stringify(rendered));
      assert(!/privacy|cookie|transport|bearer|unencrypted|encrypted|host request/.test(rendered.shareText),
        "Share surface contains task copy only", rendered.shareText);
      assert(new Set(rendered.repairNames).size === 3 &&
        rendered.repairNames.every((name) => name && name !== "Repair" && /press|row/i.test(name)),
        "English Repair controls have distinct accessible exercise names", rendered.repairNames);

      await page.locator("#shareSetupClose").click();
      await page.waitForFunction(() => document.querySelector("#shareSetupSheet")?.hidden === true);
      await page.locator('nav button[data-view="log"]').click();
      await page.waitForSelector("#log.view.active");
      await page.locator("#openSettings").click();
      await page.waitForSelector("#settings.view.active");
      await page.selectOption("#lang", "pt");
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").settings?.lang === "pt", KEY);
      await page.locator("#settingsBack").click();
      await page.waitForSelector("#log.view.active");
      await page.click('nav button[data-view="program"]');
      await page.waitForSelector("#program.view.active");
      await page.locator("#shareProgramSetup").click();
      await waitForShare(page);
      const portugueseRepairNames = await page.locator("#shareSetupBlockers [data-share-repair]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label") || node.textContent.trim()));
      assert(new Set(portugueseRepairNames).size === 3 &&
        portugueseRepairNames.every((name) => name && name !== "Corrigir" && /press|row|exercício/i.test(name)),
        "Portuguese Repair controls have distinct accessible exercise names", portugueseRepairNames);

      await clickRepair(page, "ex-missing");
      await page.locator('#exPickList [data-pick="pr_mc"]').click();
      await waitForShare(page);
      const afterBuiltInFocus = await shareFocus(page);
      assert(afterBuiltInFocus.repair === "ex-unknown" || afterBuiltInFocus.id === "shareSetupBlockerSummary",
        "successful repair focuses a remaining blocker or its status", afterBuiltInFocus);
      let durable = await readDurable(page);
      assert(durable.local?.program?.find((row) => row.id === "ex-missing")?.libraryId === "pr_mc" && durable.idb?.program?.find((row) => row.id === "ex-missing")?.libraryId === "pr_mc", "built-in repair settles the exact slot in both replicas", JSON.stringify(durable));

      await clickRepair(page, "ex-custom");
      await page.locator("#exPickCustom").click();
      await page.waitForSelector("#exCustomSheet:not(.hidden)");
      await page.locator("#exCustomName").fill("Coach cable row");
      await page.locator("#exCustomSave").click();
      await page.waitForSelector("#exCustomSheet:not(.hidden)");
      assert(await page.locator("#exCustomSheet:not(.hidden)").count() === 1, "custom repair stays open when required facts are missing");
      durable = await readDurable(page);
      assert(!(durable.local?.customExercises || []).some((row) => row.name === "Coach cable row"), "missing custom facts do not write a definition", JSON.stringify(durable.local?.customExercises));
      await page.locator("#exCustomEquip .pchip").first().click();
      await page.locator("#exCustomPrimary .pchip").first().click();
      await page.locator("#exCustomSave").click();
      await waitForShare(page);
      const afterCustomFocus = await shareFocus(page);
      assert(afterCustomFocus.repair === "ex-unknown" || afterCustomFocus.id === "shareSetupBlockerSummary",
        "custom repair focuses the remaining unresolved exercise", afterCustomFocus);
      durable = await readDurable(page);
      const customId = durable.local?.program?.find((row) => row.id === "ex-custom")?.libraryId;
      assert(typeof customId === "string" && customId.startsWith("custom:") && durable.local?.customExercises?.some((row) => row.id === customId) && durable.idb?.customExercises?.some((row) => row.id === customId), "custom definition and replacement settle atomically in both replicas", JSON.stringify(durable));

      const beforeCancel = JSON.stringify(durable.local);
      await clickRepair(page, "ex-unknown");
      await page.locator("#exPickCancel").click();
      await waitForShare(page);
      const afterCancelFocus = await shareFocus(page);
      assert(afterCancelFocus.repair === "ex-unknown" || afterCancelFocus.id === "shareSetupBlockerSummary",
        "cancelled repair returns focus to the unresolved exercise or status", afterCancelFocus);
      durable = await readDurable(page);
      assert(JSON.stringify(durable.local) === beforeCancel && durable.local?.program?.find((row) => row.id === "ex-unknown")?.libraryId === "gone:press", "picker cancel returns to Share without a durable write", JSON.stringify(durable));

      await clickRepair(page, "ex-unknown");
      await page.locator("#exPickCustom").click();
      await page.waitForSelector("#exCustomSheet:not(.hidden)");
      await page.locator("#exCustomCancel").click();
      await page.waitForFunction(() => {
        const visible = (selector) => { const node = document.querySelector(selector); return !!node && !node.classList.contains("hidden") && !node.hidden; };
        return visible("#shareSetupSheet") && !visible("#exPickSheet") && !visible("#exCustomSheet");
      }, undefined, { timeout: 5000 });
      const customCancelSurface = await page.evaluate(() => ({
        share: !document.querySelector("#shareSetupSheet")?.classList.contains("hidden"),
        picker: !document.querySelector("#exPickSheet")?.classList.contains("hidden"),
        custom: !document.querySelector("#exCustomSheet")?.classList.contains("hidden"),
      }));
      assert(customCancelSurface.share && !customCancelSurface.picker && !customCancelSurface.custom,
        "custom repair cancel returns directly to Share", JSON.stringify(customCancelSurface));
      durable = await readDurable(page);
      assert(JSON.stringify(durable.local) === beforeCancel && durable.local?.program?.find((row) => row.id === "ex-unknown")?.libraryId === "gone:press",
        "custom repair cancel discards staged changes without a durable write", JSON.stringify(durable));

      await clickRepair(page, "ex-unknown");
      await page.locator('#exPickList [data-pick="sq_bb"]').click();
      await waitForShare(page, { allowReady: true });
      const finalFocus = await shareFocus(page);
      assert(await page.locator("#shareSetupBlockers.hidden").count() === 1 &&
        (finalFocus.id === "shareSetupCopy" || finalFocus.id === "shareSetupStatus"),
        "final repair clears blockers and focuses the share action or success status", JSON.stringify({ finalFocus }));

      // Reset the fixture before the stale-target branch so that the final
      // success proof does not make the adversarial conflict unreachable.
      await writeBoth(page, seedState());
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      await page.locator('nav button[data-view="program"]').click();
      await page.waitForSelector("#program.view.active");
      await page.locator("#shareProgramSetup").click();
      await waitForShare(page);

      const stale = await readDurable(page);
      stale.local.program.find((row) => row.id === "ex-unknown").libraryId = "stale:head";
      stale.idb.program.find((row) => row.id === "ex-unknown").libraryId = "stale:head";
      stale.local._storageRevision += 1;
      stale.idb._storageRevision = stale.local._storageRevision;
      await writeBoth(page, stale.local);
      await clickRepair(page, "ex-unknown");
      await page.locator('#exPickList [data-pick="sq_bb"]').click();
      await waitForShare(page);
      durable = await readDurable(page);
      assert(durable.local?.program?.find((row) => row.id === "ex-unknown")?.libraryId === "stale:head" &&
        durable.idb?.program?.find((row) => row.id === "ex-unknown")?.libraryId === "stale:head" &&
        await page.locator('[data-share-repair="ex-unknown"]').count() === 1,
        "stale repair is discarded and never reported as repaired", JSON.stringify(durable));
      const staleFocus = await shareFocus(page);
      assert(staleFocus.repair === "ex-unknown" || staleFocus.id === "shareSetupBlockerSummary",
        "stale repair return focuses the still-unresolved blocker or status", staleFocus);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nshare repair: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) run().catch((error) => { console.error("share-repair.mjs crashed:", error); process.exit(2); });
