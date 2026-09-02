#!/usr/bin/env node
/**
 * The exercise library picker: choosing and replacing movements, authoring
 * custom exercises, and linking an imported split.
 * Run: node test/exercise-picker.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };

function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(() => typeof window.__repforgeExerciseLibrary === "object", { timeout: 15000 });
}

async function clearState(page) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

const getState = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
async function writeState(page, snapshot) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("repforge", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { key: KEY, value: snapshot });
}

async function openEditor(page) {
  // Applying the first edit may start the product tour. Dismiss it before
  // reopening the editor: endTour's first-run cleanup navigates to Log, so
  // doing this after navigating would race the editor mount.
  await page.evaluate(() => window.closeTour?.());
  await page.waitForFunction(() => !document.querySelector("#tour") || document.querySelector("#tour").classList.contains("hidden"), { timeout: 5000 });
  await page.waitForFunction(() => !document.body.classList.contains("is-sheet-open"), { timeout: 5000 });
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const btn = document.querySelector("#programEditToggle");
    if (document.querySelector("#programEditorWrap")?.classList.contains("is-hidden")) btn?.click();
  });
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 5000 });
  await page.evaluate(() => {
    document.querySelectorAll('#programEditor [data-role="day"].is-collapsed [data-role="toggle-day"]')
      .forEach(button => button.click());
  });
}

async function finishEditor(page) {
  await page.locator("#programEditToggle").evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), { timeout: 10000 });
}

async function openDetails(page, id) {
  await page.evaluate(() => window.closeTour?.());
  await page.waitForFunction(() => !document.querySelector("#tour") || document.querySelector("#tour").classList.contains("hidden"), { timeout: 5000 });
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${id}"]`);
  await row.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  if (!(await row.locator('[data-role="exercise-field"][data-field="primary"]').count()))
    await row.locator('[data-role="toggle-exercise"]').evaluate((button) => button.click());
  await row.locator('[data-role="replace"]').waitFor({ state: "visible", timeout: 5000 });
}

/** Search narrows loosely, so rows are chosen by their exact displayed name. */
async function pickExact(page, name) {
  await page.fill("#exPickSearch", name);
  await page.waitForTimeout(150);
  const ok = await page.evaluate((n) => {
    const rows = [...document.querySelectorAll("#exPickList .pickrow")];
    const row = rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim().toLowerCase() === n.toLowerCase());
    if (!row) return false;
    row.click();
    return true;
  }, name);
  return ok;
}

const settle = (page) => page.waitForTimeout(280);

async function main() {
  const browser = await launchChromium();
  const { context, page } = await freshPage(browser);
  try {
    // ---- picking into a program slot ----
    await openEditor(page);
    let state = await getState(page);
    const day = state.program[0].day;
    const idsBefore = new Set(state.program.map((e) => e.id));
    await page.click(`#programEditor [data-role="add-exercise"][data-day="${day}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });

    // + Add exercise opens the quick sheet: a short contextual list, with the
    // whole library one tap away. Typing searches everything from here.
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pick__section")].map((s) => s.textContent.trim())
    );
    assert(sections.includes("Suggested for this day"), "the quick sheet opens on suggestions",
      JSON.stringify(sections));
    await page.fill("#exPickSearch", "press");
    await page.waitForTimeout(200);
    const searched = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pick__section")].map((s) => s.textContent.trim()));
    assert(searched.includes("All exercises"), "typing searches the whole library from the quick sheet",
      JSON.stringify(searched));
    await page.fill("#exPickSearch", "");
    await page.waitForTimeout(150);

    // Both languages are searchable whichever one the UI is in, because gyms
    // label machines in either.
    await page.fill("#exPickSearch", "puxada frontal");
    await page.waitForTimeout(200);
    const ptHit = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pickrow__name")].map((n) => n.textContent.trim())
    );
    assert(ptHit.includes("Lat pulldown"), "Portuguese names are searchable from the English UI", JSON.stringify(ptHit.slice(0, 4)));

    // Filters narrow to the equipment actually in front of the lifter.
    await page.fill("#exPickSearch", "");
    await page.evaluate(() =>
      [...document.querySelectorAll("#exPickFilters .pchip")].find((b) => b.textContent.trim() === "Barbell")?.click()
    );
    await page.waitForTimeout(200);
    const onlyBarbell = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pickrow__eq")].every((e) => e.textContent.trim() === "Barbell")
    );
    assert(onlyBarbell, "an equipment filter excludes everything else");
    await page.evaluate(() =>
      [...document.querySelectorAll("#exPickFilters .pchip")].find((b) => b.textContent.trim() === "All")?.click()
    );
    await page.waitForTimeout(150);

    const picked = await pickExact(page, "Pec deck");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await finishEditor(page);
    state = await getState(page);
    // Found by id, not by name: the seed program can already contain the name,
    // and a wrong row here would make the next assertions lie.
    const added = state.program.find((e) => !idsBefore.has(e.id));
    assert(
      picked && added && added.libraryId === "ci_mc" && added.primary === "Chest" && added.day === day,
      "a picked movement arrives named, linked and muscle-tagged",
      JSON.stringify(added)
    );

    // ---- replacing the movement in a structural slot ----
    const slotId = added.id;
    await openEditor(page);
    await openDetails(page, slotId);
    await page.click(`#programEditor [data-role="replace"][data-id="${slotId}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await pickExact(page, "Cable fly");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await finishEditor(page);
    state = await getState(page);
    const swapped = state.program.find((e) => e.id === slotId);
    assert(
      swapped && swapped.name === "Cable fly" && swapped.libraryId === "ci_cb",
      "changing a slot repoints it at the new movement",
      JSON.stringify(swapped)
    );
    assert(
      state.program.filter((e) => !idsBefore.has(e.id)).length === 1,
      "changing a slot replaces rather than adds",
      JSON.stringify(state.program.filter((e) => !idsBefore.has(e.id)).map((e) => e.name))
    );

    // Draft fields and ordering keep the structural id. Performed history uses
    // the library movement id and is covered by performed-attribution.mjs.
    assert(swapped.id === slotId, "the structural slot keeps its id across a replacement", `${swapped.id} vs ${slotId}`);

    // ---- a rename is an alias, not a change of movement ----
    await openEditor(page);
    const slotName = page.locator(`#programEditor [data-role="exercise-field"][data-id="${slotId}"][data-field="name"]`);
    await slotName.fill("Hammer Strength fly");
    await slotName.blur();
    await settle(page);
    await finishEditor(page);
    state = await getState(page);
    const renamed = state.program.find((e) => e.id === slotId);
    assert(
      renamed.name === "Hammer Strength fly" && renamed.displayName === "Hammer Strength fly" &&
        renamed.libraryId === "ci_cb",
      "renaming a linked slot stores an alias and keeps the link",
      JSON.stringify(renamed)
    );
    // The whole point of the alias: the id still means one movement, so the
    // muscles the audit reads are the definition's, not whatever was typed.
    assert(
      renamed.primary === "Chest" && renamed.secondary === "Front delts",
      "an aliased slot keeps the definition's muscles",
      JSON.stringify([renamed.primary, renamed.secondary])
    );
    await openEditor(page);
    await openDetails(page, slotId);
    const musclesLocked = await page.evaluate((id) =>
      ["primary", "secondary"].every((f) =>
        document.querySelector(`#programEditor [data-role="exercise-field"][data-id="${id}"][data-field="${f}"]`)?.readOnly), slotId);
    assert(musclesLocked, "a linked slot's muscle fields are not editable in place");
    await finishEditor(page);

    // ---- custom exercises ----
    await openEditor(page);
    await page.click(`#programEditor [data-role="add-exercise"][data-day="${day}"]`);
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("#exPickFilters .pchip")].find((b) => b.textContent.trim() === "Machine")?.click());
    await page.fill("#exPickSearch", "Belt squat");
    await page.waitForTimeout(200);
    const emptyCopy = await page.evaluate(() => document.querySelector("#exPickList .pick__empty")?.textContent || "");
    assert(emptyCopy.includes("Belt squat"), "a search with no hits offers to create it", emptyCopy);

    await page.click("#exPickCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    assert(
      (await page.inputValue("#exCustomName")) === "Belt squat",
      "the typed search becomes the custom exercise's name"
    );
    await page.click("#exCustomCancel");
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    const resumedPicker = await page.evaluate(() => ({
      query: document.querySelector("#exPickSearch")?.value,
      machine: [...document.querySelectorAll("#exPickFilters .pchip")]
        .some((b) => b.textContent.trim() === "Machine" && b.classList.contains("is-active")),
    }));
    assert(resumedPicker.query === "Belt squat" && resumedPicker.machine,
      "cancelling a custom detour restores the picker search and filters", JSON.stringify(resumedPicker));
    await page.click("#exPickCustom");
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    await page.evaluate(() => {
      // Equipment and a primary muscle are required: the wizard filters on one
      // and the volume audit groups by the other.
      [...document.querySelectorAll("#exCustomEquip .pchip")].find((b) => b.textContent.trim() === "Machine")?.click();
      [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Quads")?.click();
      [...document.querySelectorAll("#exCustomSecondary .pchip")].find((b) => b.textContent.trim() === "Glutes")?.click();
    });
    await page.click("#exCustomSave");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    await finishEditor(page);
    state = await getState(page);
    const custom = (state.customExercises || [])[0];
    const inProgram = state.program.find((e) => e.name === "Belt squat");
    assert(
      custom && custom.name === "Belt squat" && custom.primary === "Quads" && custom.secondary === "Glutes",
      "a custom exercise is stored with its muscle tags",
      JSON.stringify(custom)
    );
    assert(
      inProgram && inProgram.libraryId === custom.id && inProgram.primary === "Quads",
      "creating one from the picker drops it straight into the slot",
      JSON.stringify(inProgram)
    );

    // A custom exercise outlives the program that introduced it. Asked for on
    // another day, since a day never offers what it already holds.
    const otherDay = state.program.map((e) => e.day).find((d) => d !== day);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await openEditor(page);
    await page.click(`#programEditor [data-role="add-exercise"][data-day="${otherDay}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("#exPickTabs .picktab")].find((b) => b.textContent.trim() === "Yours")?.click());
    await page.waitForTimeout(200);
    const yourSection = await page.evaluate(() =>
      [...document.querySelectorAll("#exPickList .pickrow__name")].map((n) => n.textContent.trim()));
    assert(
      yourSection.includes("Belt squat"),
      "custom exercises survive a reload and fill the Yours tab",
      JSON.stringify(yourSection)
    );
    await page.click("#exPickCancel");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });

    // A definition a program slot still points at is visibly archived rather
    // than deleted: exercise history keeps its meaning, while Yours hides it.
    await page.evaluate((d) => window.__repforgeOpenLibrary({ day: d }), otherDay);
    await page.waitForSelector("#library.active", { timeout: 5000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("#libTabs .picktab")].find((b) => b.textContent.trim() === "Yours")?.click());
    await settle(page);
    await page.evaluate((id) => document.querySelector(`[data-lib-edit="${id}"]`)?.click(), custom.id);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    const archiveUi = await page.evaluate(() => ({
      note: !document.querySelector("#exCustomInUse")?.classList.contains("hidden"),
      button: document.querySelector("#exCustomDelete")?.textContent?.trim(),
      visible: !document.querySelector("#exCustomDelete")?.classList.contains("hidden"),
    }));
    assert(archiveUi.note && archiveUi.visible && /archive/i.test(archiveUi.button),
      "the in-use editor exposes an Archive action and explains it", JSON.stringify(archiveUi));
    await page.click("#exCustomDelete");
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    const archived = await page.evaluate((id) => {
      const all = window.__repforgeCustomExercises?.() || [];
      const pickable = window.__repforgePickableExercises?.() || [];
      return { archived: all.find((e) => e.id === id)?.archived === true,
        stillStored: all.some((e) => e.id === id), offered: pickable.some((e) => e.id === id) };
    }, custom.id);
    assert(
      archived.archived && archived.stillStored,
      "a custom exercise in use is archived, not destroyed",
      JSON.stringify(archived)
    );
    assert(
      !archived.offered,
      "an archived definition stops being offered in the pickers",
      JSON.stringify(archived)
    );

    // A custom definition can be referenced only by an archived program. Boot
    // normalization must resolve that historical link against the snapshot's
    // custom list, or Delete will incorrectly destroy the definition.
    const historyId = "custom:history-only";
    state = await getState(page);
    state.customExercises.push({
      id: historyId, name: "History-only row", namePt: "History-only row", archived: false,
      equipment: ["machine"], primary: "Lats", secondary: "Biceps", notes: "",
      created: "2026-08-01T00:00:00.000Z",
    });
    state.programHistory.push({
      id: "history-custom-program",
      program: [{
        id: "history-custom-slot", movementId: `library:${historyId}`, libraryId: historyId,
        name: "History-only row", day: "Archived Day", order: 1, sets: 3, min: 8, max: 12,
        primary: "Lats", secondary: "Biceps", notes: "", alternates: [],
      }],
    });
    await writeState(page, state);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const historyDelete = await page.evaluate(async (id) => {
      const result = await window.__repforgeDeleteCustomExercise(id);
      const stored = window.__repforgeCustomExercises().find((e) => e.id === id);
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return {
        resultArchived: result?.archived === true,
        storedArchived: stored?.archived === true,
        historyLinked: raw.programHistory?.some((h) => h.program?.some((e) => e.libraryId === id)),
      };
    }, historyId);
    assert(
      historyDelete.resultArchived && historyDelete.storedArchived && historyDelete.historyLinked,
      "a history-only custom exercise remains linked and is archived rather than deleted after reload",
      JSON.stringify(historyDelete)
    );

    // ---- imported splits get linked to the library ----
    const linked = await page.evaluate(() => {
      const rows = [
        { day: "Day 1", order: 1, name: "Lat pulldown", sets: 3, min: 6, max: 10 },
        { day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 6, max: 10 },
        { day: "Day 1", order: 3, name: "Reverse Zercher goblet thing", sets: 3, min: 6, max: 10 },
      ];
      const summary = window.__repforgeLinkImported(rows);
      return { summary, rows };
    });
    assert(
      linked.summary.linked === 2 && linked.summary.total === 3,
      "importing links the names the library knows, in either language",
      JSON.stringify(linked.summary)
    );
    assert(
      linked.rows[0].libraryId === "pd_mc" && linked.rows[0].primary === "Lats" &&
        linked.rows[1].libraryId === "pd_mc",
      "a linked import gains muscle tags it did not carry",
      JSON.stringify(linked.rows.map((r) => [r.name, r.libraryId, r.primary]))
    );
    assert(
      !linked.rows[2].libraryId && linked.rows[2].name === "Reverse Zercher goblet thing",
      "an unmatched import keeps exactly what was imported",
      JSON.stringify(linked.rows[2])
    );
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nexercise picker: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
