#!/usr/bin/env node
/**
 * The library flow: quick add on a day, the full browse it opens into,
 * previewing a definition, configuring several at once, and managing custom
 * exercises through the UI rather than through a test hook.
 *
 * Also holds the artwork contract to its promise — exactly the mapped
 * exercises show an image, everything else shows an empty tile, and nothing
 * issues a request for a file that is not there.
 *
 * Run: node test/library-flow.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(() => typeof window.__repforgeExerciseLibrary === "object", { timeout: 15000 });
}

const getState = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
const settle = (page, ms = 300) => page.waitForTimeout(ms);
const flow = (page) => page.evaluate(() => window.__repforgeLibraryFlow());

async function reset(page) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  // A cleared device has no program; the editor these cases open needs one.
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
}

async function openEditor(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await settle(page, 200);
  await page.evaluate(() => {
    if (document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"))
      document.querySelector("#programEditToggle")?.click();
  });
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 5000 });
}

async function finishEditor(page) {
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), { timeout: 10000 });
}

/** Toggles a library row by its exact displayed name. */
const toggleRow = (page, name) => page.evaluate((n) => {
  const row = [...document.querySelectorAll("#libList .librow")]
    .find((r) => (r.querySelector(".librow__name")?.textContent || "").trim() === n);
  if (!row) return false;
  row.querySelector("[data-lib-toggle]").click();
  return true;
}, name);

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const dialogs = [];
  let nextDialogAction = "accept";
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    const action = nextDialogAction;
    nextDialogAction = "accept";
    await dialog[action]();
  });
  const badRequests = [];
  const isExerciseArtwork = (url) => new URL(url).pathname.includes("/assets/exercises/");
  page.on("requestfailed", (r) => { if (isExerciseArtwork(r.url())) badRequests.push(r.url()); });
  page.on("response", (r) => {
    if (r.status() >= 400 && isExerciseArtwork(r.url())) badRequests.push(`${r.status()} ${r.url()}`);
  });
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await reset(page);
    await openEditor(page);
    const day = (await getState(page)).program[0].day;

    // ---- quick add ----
    await page.click(`#programEditor [data-role="add-exercise"][data-day="${day}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickTabs .picktab")].map((b) => b.textContent.trim()));
    assert(
      JSON.stringify(tabs) === JSON.stringify(["Suggested", "Recent", "Yours"]),
      "the quick sheet offers Suggested, Recent and Yours",
      JSON.stringify(tabs)
    );
    const suggested = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pickrow__name")].map((n) => n.textContent.trim()));
    assert(suggested.length > 0 && suggested.length <= 6,
      "suggestions are a short list, not the whole library", `${suggested.length} rows`);
    const onDay = (await getState(page)).program.filter((e) => e.day === day).map((e) => e.name);
    assert(
      !suggested.some((n) => onDay.includes(n)),
      "the day's own exercises are not suggested back to it",
      JSON.stringify(suggested)
    );

    // ---- route into the full library ----
    await page.click("#exPickFull");
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await settle(page);
    assert(
      await page.evaluate(() => getComputedStyle(document.querySelector("nav")).display === "none"),
      "the full library takes the screen instead of adding a nav tab"
    );

    // ---- artwork contract ----
    const media = await page.evaluate(() => ({
      rows: document.querySelectorAll("#libList .librow").length,
      images: document.querySelectorAll("#libList img.exthumb").length,
      empties: document.querySelectorAll("#libList span.exthumb--empty").length,
      emptyHasNoSrc: [...document.querySelectorAll("#libList span.exthumb--empty")].every((s) => !s.getAttribute("src")),
      emptyIsHidden: [...document.querySelectorAll("#libList span.exthumb--empty")].every((s) => s.getAttribute("aria-hidden") === "true"),
      emptyIsBlank: [...document.querySelectorAll("#libList span.exthumb--empty")].every((s) => !s.textContent.trim() && !s.children.length),
      lazy: [...document.querySelectorAll("#libList img.exthumb")].every((i) => i.loading === "lazy"),
    }));
    assert(media.images === 96, "exactly the mapped exercises show artwork", `${media.images} of ${media.rows}`);
    assert(media.empties === media.rows - 96, "every other row shows an empty tile",
      `${media.empties} empties, ${media.rows} rows`);
    assert(media.emptyHasNoSrc && media.emptyIsBlank,
      "the empty tile is genuinely empty — no src, no glyph, no text");
    assert(media.emptyIsHidden, "the empty tile is hidden from screen readers");
    assert(media.lazy, "artwork decodes lazily in a long list");
    await settle(page, 800);
    assert(
      badRequests.length === 0,
      "no request is issued for missing artwork",
      JSON.stringify(badRequests.slice(0, 4))
    );

    // ---- preview ----
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("#libList .librow")]
        .find((r) => (r.querySelector(".librow__name")?.textContent || "").trim() === "Lat pulldown");
      row?.querySelector("[data-lib-preview]")?.click();
    });
    await page.waitForSelector("#exercisePreview.active", { timeout: 5000 });
    const preview = await page.evaluate(() => ({
      title: document.querySelector(".preview__title")?.textContent?.trim(),
      rows: [...document.querySelectorAll(".preview__row dd")].map((d) => d.textContent.trim()),
      art: !!document.querySelector(".preview .exthumb--lg:not(.exthumb--empty)"),
      alt: document.querySelector(".preview img.exthumb--lg")?.getAttribute("alt"),
      add: document.querySelector("#previewAdd")?.textContent?.trim(),
    }));
    assert(preview.title === "Lat pulldown", "preview shows the canonical name", JSON.stringify(preview));
    assert(preview.rows[0] === "Lats", "preview shows the definition's muscles", JSON.stringify(preview.rows));
    assert(preview.art && !!preview.alt,
      "a large illustration is described, unlike the list thumbnails", JSON.stringify([preview.art, preview.alt]));
    assert(preview.add?.includes(day), "preview offers to add to the day being built", preview.add);
    await page.click("#previewAdd");
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await settle(page);
    const previewFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-lib-preview"));
    assert(previewFocus === "pd_mc", "closing a preview returns focus to its library row", String(previewFocus));
    let model = await flow(page);
    assert(
      model.selected.includes("pd_mc"),
      "adding from the preview selects it and returns to the library",
      JSON.stringify(model)
    );

    // ---- multi-select and batch configuration ----
    assert(await toggleRow(page, "Barbell bench press"), "selected a second exercise");
    await settle(page);
    const barText = await page.evaluate(() => ({
      count: document.querySelector("#libBarCount")?.textContent?.trim(),
      cta: document.querySelector("#libPrimary")?.textContent?.trim(),
    }));
    assert(barText.count === "2 selected" && barText.cta === `Add 2 to ${day}`,
      "the action bar counts the selection", JSON.stringify(barText));

    await page.click("#libPrimary");
    await settle(page, 400);
    model = await flow(page);
    assert(model.step === "configure", "adding several moves to configuration, not straight into the day");
    const cfgRows = await page.evaluate(() => document.querySelectorAll("#libConfigureRows .libcfg").length);
    assert(cfgRows === 2, "every selected exercise gets a configuration row", `${cfgRows} rows`);

    await page.evaluate(() => {
      const set = (i, field, v) => {
        const el = document.querySelectorAll(`#libConfigureRows [data-cfg-field="${field}"]`)[i];
        if (el) { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }
      };
      set(0, "sets", 4); set(0, "min", 8); set(0, "max", 12);
    });
    await settle(page, 200);
    await page.click("#libPrimary");
    await settle(page, 800);

    const state = await getState(page);
    const added = state.program.filter((e) => e.day === day && ["pd_mc", "pr_bb"].includes(e.libraryId));
    assert(added.length === 2, "both exercises land on the day", JSON.stringify(added.map((e) => e.name)));
    const configured = added.find((e) => e.libraryId === "pd_mc");
    assert(
      configured && configured.sets === 4 && configured.min === 8 && configured.max === 12,
      "the configured sets and rep range are what gets saved",
      JSON.stringify(configured)
    );
    const landedOn = await page.evaluate(() =>
      [...document.querySelectorAll(".view.active")].map((v) => v.id).join(","));
    assert(landedOn === "program", "saving the day returns to the program", landedOn);

    // ---- custom exercises, through the UI ----
    await openEditor(page);
    await page.evaluate((d) => window.__repforgeOpenLibrary({ day: d }), day);
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("#libFilters .pchip")].find((b) => b.textContent.trim() === "Legs")?.click());
    await page.fill("#libSearch", "Belt squat");
    await settle(page);
    await page.click("#libCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    assert((await page.inputValue("#exCustomName")) === "Belt squat",
      "the typed search names the new definition");
    await page.click("#exCustomCancel");
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await settle(page);
    let resumed = await flow(page);
    assert(resumed.query === "Belt squat" && resumed.muscle === "legs",
      "cancelling a custom detour restores full-library search and filters", JSON.stringify(resumed));
    await page.click("#libCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    const startingEquipment = await page.evaluate(() =>
      document.querySelectorAll("#exCustomEquip .pchip.is-active").length);
    assert(startingEquipment === 0, "a new definition starts with no equipment assumed",
      `${startingEquipment} preselected`);

    // Required fields are actually required.
    await page.click("#exCustomSave");
    await settle(page, 200);
    assert(
      await page.evaluate(() => document.querySelector("#exCustomSheet")?.classList.contains("is-open")),
      "saving without equipment is refused"
    );
    await page.evaluate(() =>
      [...document.querySelectorAll("#exCustomEquip .pchip")].find((b) => b.textContent.trim() === "Machine")?.click());
    await page.click("#exCustomSave");
    await settle(page, 200);
    assert(
      await page.evaluate(() => document.querySelector("#exCustomSheet")?.classList.contains("is-open")),
      "saving without a primary muscle is refused"
    );
    await page.evaluate(() =>
      [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Quads")?.click());
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await settle(page, 500);

    model = await flow(page);
    const custom = (await getState(page)).customExercises[0];
    assert(!!custom && custom.name === "Belt squat", "the definition is stored", JSON.stringify(custom));
    assert(
      model && model.selected.includes(custom.id),
      "creating from the library returns to it with the new exercise selected",
      JSON.stringify(model)
    );
    assert(model.query === "Belt squat" && model.muscle === "legs",
      "creating a custom exercise does not reset the browse context", JSON.stringify(model));

    // Editing it is reachable from Yours.
    await page.evaluate(() => {
      [...document.querySelectorAll("#libTabs .picktab")].find((b) => b.textContent.trim() === "Yours")?.click();
    });
    await settle(page);
    const editable = await page.evaluate(() => document.querySelectorAll("#libList .librow__edit").length);
    assert(editable >= 1, "custom exercises carry an edit affordance in Yours", `${editable} found`);
    await page.click("#libList .librow__edit");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    assert(
      (await page.inputValue("#exCustomName")) === "Belt squat",
      "editing opens the existing definition, not a blank form"
    );
    await page.fill("#exCustomName", "Belt squat (blue)");
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await settle(page, 500);
    const editedList = (await getState(page)).customExercises;
    assert(
      editedList.length === 1 && editedList[0].name === "Belt squat (blue)",
      "editing changes the definition instead of adding another",
      JSON.stringify(editedList.map((e) => e.name))
    );
    resumed = await flow(page);
    assert(resumed.tab === "yours" && resumed.selected.includes(custom.id),
      "editing a custom exercise restores the Yours tab and selection", JSON.stringify(resumed));

    // A name that already exists offers the existing one.
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await page.fill("#libSearch", "Lat pulldown");
    await settle(page);
    await page.click("#libCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.evaluate(() => {
      [...document.querySelectorAll("#exCustomEquip .pchip")].find((b) => b.textContent.trim() === "Machine")?.click();
      [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Lats")?.click();
    });
    await page.click("#exCustomSave");
    await settle(page, 600);
    const afterDup = (await getState(page)).customExercises;
    assert(
      afterDup.length === 1,
      "a duplicate name offers the existing exercise instead of forking it",
      JSON.stringify(afterDup.map((e) => e.name))
    );

    // Duplicate acknowledgement belongs to the exact existing entry, even
    // when custom creation starts from the ordinary library route.
    const standardBefore = await getState(page);
    const standardA = await page.evaluate(() => window.__repforgeLibraryEntry("pr_mc"));
    const standardB = await page.evaluate(() => window.__repforgeLibraryEntry("pr_bb"));
    await page.fill("#libSearch", standardA.name);
    await page.click("#libCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.locator("#exCustomName").fill(standardA.name);
    let dialogCount = dialogs.length;
    nextDialogAction = "dismiss";
    await page.click("#exCustomSave");
    assert(dialogs.length === dialogCount + 1 && dialogs[dialogCount]?.type === "confirm" &&
      dialogs[dialogCount].message.includes(standardA.name),
      "ordinary custom creation confirms duplicate A before custom validation", JSON.stringify(dialogs.slice(dialogCount)));

    await page.locator("#exCustomName").fill(standardB.name);
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    dialogCount = dialogs.length;
    nextDialogAction = "accept";
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await page.waitForFunction(({ id, previousCustomIds }) => {
      const selected = window.__repforgeLibraryFlow()?.selected || [];
      return selected.includes(id) || selected.some(selectedId =>
        selectedId.startsWith("custom:") && !previousCustomIds.includes(selectedId));
    }, { id: standardB.id, previousCustomIds: (standardBefore.customExercises || []).map(entry => entry.id) }, { timeout: 5000 });
    assert(dialogs.length === dialogCount + 1 && dialogs[dialogCount]?.type === "confirm" &&
      dialogs[dialogCount].message.includes(standardB.name),
      "declining duplicate A does not suppress B's confirmation in ordinary custom creation", JSON.stringify(dialogs.slice(dialogCount)));
    const standardAfter = await getState(page);
    assert(JSON.stringify(standardAfter.customExercises || []) === JSON.stringify(standardBefore.customExercises || []),
      "accepting B in ordinary custom creation does not append a custom definition", JSON.stringify(standardAfter.customExercises));
    assert((await flow(page)).selected.includes(standardB.id),
      "ordinary custom creation routes the accepted duplicate to B's exact library identity", JSON.stringify(await flow(page)));

    const existingCustom = (standardBefore.customExercises || [])[0];
    const dialogsBeforeEdit = dialogs.length;
    await page.evaluate((id) => window.__repforgeEditCustom(id), existingCustom.id);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.locator("#exCustomName").fill(standardA.name);
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    const editedDuplicate = (await getState(page)).customExercises.find(entry => entry.id === existingCustom.id);
    assert(dialogs.length === dialogsBeforeEdit,
      "editing an existing custom definition does not enter new-definition duplicate confirmation", JSON.stringify(dialogs.slice(dialogsBeforeEdit)));
    assert(editedDuplicate?.id === existingCustom.id && editedDuplicate.name === standardA.name,
      "editing a custom name that matches a built-in preserves the existing custom identity", JSON.stringify(editedDuplicate));

    await page.evaluate((id) => window.__repforgeEditCustom(id), existingCustom.id);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.locator("#exCustomName").fill(existingCustom.name);
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });

    const beforeRapidSave = await getState(page);
    const rapidName = "Rapid save custom";
    await page.fill("#libSearch", rapidName);
    await page.click("#libCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.locator("#exCustomName").fill(rapidName);
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    const rapidSubmitState = await page.evaluate(() => {
      const save = document.querySelector("#exCustomSave");
      save.click();
      const state = {
        saveDisabled: save.disabled,
        saveLabel: save.textContent,
        cancelDisabled: document.querySelector("#exCustomCancel").disabled,
        sheetBusy: document.querySelector("#exCustomSheet").getAttribute("aria-busy") === "true",
      };
      document.querySelector("#exCustomCancel").click();
      save.click();
      return state;
    });
    assert(rapidSubmitState.saveDisabled && rapidSubmitState.cancelDisabled && rapidSubmitState.sheetBusy &&
      rapidSubmitState.saveLabel === "Saving…",
      "an asynchronous custom save disables repeat actions and announces its visible busy state", JSON.stringify(rapidSubmitState));
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden") && toast.textContent === "Exercise created.";
    }, undefined, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 5000 });
    const afterRapidSave = await getState(page);
    assert((afterRapidSave.customExercises || []).filter(entry => entry.name === rapidName).length === 1 &&
      (afterRapidSave.customExercises || []).length === (beforeRapidSave.customExercises || []).length + 1,
      "rapid repeated Save clicks create one custom definition", JSON.stringify(afterRapidSave.customExercises));

    // An unused definition is deleted through the visible editor action.
    await page.evaluate((id) => window.__repforgeEditCustom(id), editedList[0].id);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    const deleteUi = await page.evaluate(() => ({
      inUse: !document.querySelector("#exCustomInUse")?.classList.contains("hidden"),
      button: document.querySelector("#exCustomDelete")?.textContent?.trim(),
      visible: !document.querySelector("#exCustomDelete")?.classList.contains("hidden"),
    }));
    assert(!deleteUi.inUse && deleteUi.visible && /delete/i.test(deleteUi.button),
      "an unused definition offers Delete without an in-use warning", JSON.stringify(deleteUi));
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const writeIdb = io.writeIdb;
      io.writeIdb = snapshot => new Promise((resolve, reject) => {
        window.__releaseCustomDeleteWrite = () => writeIdb.call(io, snapshot).then(resolve, reject);
      });
    });
    await page.click("#exCustomDelete");
    await page.waitForFunction(() => typeof window.__releaseCustomDeleteWrite === "function", undefined, { timeout: 5000 });
    const deleting = await page.evaluate(() => ({
      saveLabel: document.querySelector("#exCustomSave")?.textContent?.trim(),
      saveDisabled: document.querySelector("#exCustomSave")?.disabled,
      deleteLabel: document.querySelector("#exCustomDelete")?.textContent?.trim(),
      deleteDisabled: document.querySelector("#exCustomDelete")?.disabled,
      cancelDisabled: document.querySelector("#exCustomCancel")?.disabled,
      sheetBusy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy") === "true",
    }));
    assert(deleting.saveLabel === "Save" && deleting.saveDisabled && deleting.deleteLabel === "Deleting…" &&
      deleting.deleteDisabled && deleting.cancelDisabled && deleting.sheetBusy,
      "an in-flight custom delete announces deletion and disables every competing action", JSON.stringify(deleting));
    await page.evaluate(() => window.__releaseCustomDeleteWrite());
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    const remains = (await getState(page)).customExercises.some((e) => e.id === editedList[0].id);
    assert(!remains, "the visible Delete action removes an unused definition");

    // The full Library's final Save must wait for both durable replicas before
    // closing or announcing a successful Program edit.
    await reset(page);
    const partialTarget = await page.evaluate(async () => {
      const saved = await window.__repforgeSaveCustomExercise({
        name: "Partial library add", equipment: ["machine"], primary: "Chest", secondary: "", notes: "",
      });
      return saved.entry?.id || null;
    });
    assert(!!partialTarget, "a custom definition is available for the partial library-write fixture");
    await page.evaluate(() => window.__repforgeOpenLibrary({}));
    await page.waitForSelector(`#libList [data-lib-toggle="${partialTarget}"]`, { timeout: 5000 });
    await page.locator(`#libList [data-lib-toggle="${partialTarget}"]`).click();
    await page.click("#libPrimary");
    await page.waitForSelector(`#libConfigureRows [data-cfg="${partialTarget}"]`, { timeout: 5000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      window.__libraryWriteIdb = io.writeIdb;
      io.writeIdb = () => Promise.resolve(false);
    });
    await page.click("#libPrimary");
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden");
    }, undefined, { timeout: 10000 });
    const partialUi = await page.evaluate(() => ({
      libraryOpen: document.querySelector("#library")?.classList.contains("active") === true,
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
    }));
    assert(partialUi.libraryOpen && !partialUi.toast.includes("exercises added"),
      "a one-replica full-library Program write is not presented as success", JSON.stringify(partialUi));
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      if (window.__libraryWriteIdb) io.writeIdb = window.__libraryWriteIdb;
    });
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nlibrary flow: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
