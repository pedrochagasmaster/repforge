#!/usr/bin/env node
/**
 * Importing a program is a review, not a write.
 *
 * Reading a file used to link names and replace the program behind one
 * confirm(), so a wrong file had already landed by the time you saw it. Now the
 * file is parsed into a transient model, every name is classified, likely
 * matches have to be looked at, and the reviewed candidate stays separate
 * until the lifter explicitly activates it.
 *
 * Also covers what a program file has to carry to be portable: version 3
 * embeds the custom definitions the program references, and importing them
 * cannot overwrite a different local definition that happens to share an id.
 *
 * And what happens when the file is not a program at all: a full backup
 * dropped on this door used to import its exercises and drop its sessions
 * without a word, so a restore looked like it had worked and left History
 * empty. The backup is recognised and the restore offered instead — including
 * when it carries no sessions at all, since the settings, the language and the
 * program's own identity are still in the file and still lost without it.
 *
 * Run: node test/program-import-review.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram, seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";

// Catalog movements these cases resolve to. Names are search inputs; these ids
// are what a matched row is expected to mean.
const BACK_SQUAT = "1a25c6f170d8803d8231d083fdd65458"; // Barbell back squat
const BENCH_PRESS = "19f5c6f170d8808bb424e98de4472a7e"; // Barbell bench press
// "Puxada frontal na máquina pegada neutra" is the Portuguese name of
// Neutral grip pin-loaded machine lat pulldown.
const PULLDOWN_NEUTRAL = "2ae5c6f170d8805da4e1d8dc785bc9ea";
// The first proposal for "Lat pulldown machine thing": Overhand grip cable lat pulldown.
const PULLDOWN_OVERHAND = "1a15c6f170d8800d8fc9d2c235673bf6";
const BENT_OVER_ROW = "1a15c6f170d880f89beacd8c81156f2d"; // Bent-over barbell row
const LEG_PRESS_45 = "1a25c6f170d88079a926dde776766181"; // 45° leg press

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
const settle = (page, ms = 350) => page.waitForTimeout(ms);
const draftModel = (page) => page.evaluate(() => window.__repforgeImportDraft());

async function reset(page) {
  await page.evaluate(async ({ k, d, setup }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    localStorage.removeItem(setup);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT, setup: SETUP_DRAFT });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

/**
 * The same reset with a program installed. A cleared device has not been
 * through onboarding and holds none, so the installed editor these cases import
 * through has nothing to open; the onboarding cases below want the bare reset.
 */
async function resetWithProgram(page) {
  await reset(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
}

async function openEditor(page) {
  await page.evaluate(() => {
    if (document.querySelector("#tour") && !document.querySelector("#tour")?.classList.contains("hidden"))
      window.closeTour?.();
    document.querySelector('nav button[data-view="program"]')?.click();
  });
  await settle(page, 200);
  const hidden = await page.locator("#programEditorWrap").evaluate((element) =>
    element.classList.contains("is-hidden")
  );
  if (hidden) await page.click("#programEditToggle");
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 5000 });
  // Import and export remain in the installed editor's Advanced disclosure.
  // Keep that host mounted so the controls are actually reachable; the shared
  // editor itself owns the ordinary editing surface.
  await page.locator("#program details.advanced").evaluate((details) => { details.open = true; });
}

async function importFile(page, name, body) {
  await page.setInputFiles("#importProgram", {
    name, mimeType: name.endsWith(".txt") ? "text/plain" : "application/json",
    buffer: Buffer.from(body),
  });
  await settle(page, 500);
}

/** Settles every open row on its first proposal. One decision at a time: each
 *  click re-renders the list, so a captured NodeList goes stale after the first. */
async function acceptFirstProposals(page) {
  for (let guard = 0; guard < 24; guard++) {
    const acted = await page.evaluate(() => {
      const row = document.querySelector("#importRows .improw.is-open");
      const action = row && (row.querySelector('[data-imp-act="pick"][data-imp-idx="0"]') ||
        row.querySelector('[data-imp-act="link"]'));
      if (!action) return false;
      action.click();
      return true;
    });
    if (!acted) break;
    await settle(page, 150);
  }
}

async function stageReviewedImport(page) {
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  await settle(page, 200);
}

async function activateStagedImport(page) {
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.click("#entryActivate");
  // Replacing an active program asks first; the dialog stands where the native confirm did.
  const replace = page.locator("#entryReplaceConfirm");
  if (await replace.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await replace.click();
  try {
    await page.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before,
      { key: KEY, before }, { timeout: 10000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      entry: window.__repforgeOnboarding.entry(),
      activeRevision: JSON.parse(localStorage.getItem("repforge_v1") || "{}")._storageRevision,
      activateVisible: !!document.querySelector("#entryActivate"),
      notice: document.querySelector(".entry__notice")?.textContent?.trim() || null,
    }));
    throw new Error(`Import activation did not change active state: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  await settle(page, 350);
}

async function reviewAndActivateImport(page) {
  await stageReviewedImport(page);
  await activateStagedImport(page);
}

async function downloadJson(page, selector) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.click(selector),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// A custom movement carries its own metric composition; a definition without
// one needs configuring before it can be trained, so a portable file brings it.
const WEIGHT_REPS = {
  metricIds: ["2555c6f170d8805cafa6d16d3fdddbaa", "2555c6f170d88072bbf6d9ad3f16ea86"],
  metricDefinitions: [
    { id: "2555c6f170d8805cafa6d16d3fdddbaa", sourceName: "Weight", semantic: "loadKg", unit: "kg" },
    { id: "2555c6f170d88072bbf6d9ad3f16ea86", sourceName: "Reps", semantic: "reps", unit: "reps" },
  ],
};

const v3 = JSON.stringify({
  version: 3,
  meta: { name: "Imported split" },
  exercises: [
    { id: "slot-heavy", day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 },
    { id: "slot-volume", day: "Day 1", order: 2, name: "Puxada frontal na máquina pegada neutra", sets: 3, min: 8, max: 12 },
    { day: "Day 1", order: 3, name: "Lat pulldown machine thing", sets: 3, min: 8, max: 12 },
    { day: "Day 2", order: 1, name: "Zerbulator 9000", sets: 3, min: 8, max: 12 },
    { day: "Day 2", order: 2, name: "My gym row", sets: 3, min: 8, max: 12, libraryId: "custom:shared" },
  ],
  customExercises: [
    { id: "custom:shared", name: "My gym row", equipment: ["machine"], primary: "Mid/upper back", secondary: "Biceps", ...WEIGHT_REPS },
  ],
});

/** The slots of the active canonical definition, in week order. */
const definitionSlots = (definition) => (definition?.days || []).flatMap((day) => day.slots || []);

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await resetWithProgram(page);
    await openEditor(page);

    const acceptedTypes = await page.getAttribute("#importProgram", "accept");
    assert(
      acceptedTypes?.includes(".json") && acceptedTypes.includes(".txt") && acceptedTypes.includes("text/plain"),
      "the program importer advertises both JSON and plain-text files",
      acceptedTypes
    );

    // Two tabs can create different custom definitions before either one
    // flushes. Rebasing must preserve both additions, just like log sessions
    // and program-history entries.
    const concurrentCustoms = await page.evaluate(() => {
      const empty = { settings: {}, programMeta: {}, program: [], log: [], programHistory: [], customExercises: [] };
      const mine = structuredClone(empty);
      const theirs = structuredClone(empty);
      mine.customExercises.push({ id: "custom:mine", name: "Mine" });
      theirs.customExercises.push({ id: "custom:theirs", name: "Theirs" });
      return window.__repforgeStorage.rebaseForTest(empty, mine, theirs).customExercises.map((e) => e.id).sort();
    });
    assert(
      JSON.stringify(concurrentCustoms) === JSON.stringify(["custom:mine", "custom:theirs"]),
      "concurrent custom-exercise additions merge instead of overwriting each other",
      JSON.stringify(concurrentCustoms)
    );

    // ---- staging writes nothing ----
    const before = await getState(page);
    await importFile(page, "split.json", v3);
    assert(
      await page.evaluate(() => document.querySelector("#importReview")?.classList.contains("active")),
      "reading a file opens the review screen"
    );
    const reviewFocus = await page.evaluate(() => ({
      action: document.activeElement?.getAttribute("data-imp-act"),
      row: document.activeElement?.closest(".improw")?.querySelector(".improw__from")?.textContent?.trim(),
    }));
    assert(
      !!reviewFocus.action && reviewFocus.row === "Lat pulldown machine thing",
      "an unresolved import focuses its first decision instead of the disabled commit button",
      JSON.stringify(reviewFocus)
    );
    let after = await getState(page);
    assert(
      JSON.stringify(after.program) === JSON.stringify(before.program) &&
        (after.customExercises || []).length === 0,
      "nothing durable changes while the import is being reviewed",
      `${after.program.length} vs ${before.program.length}`
    );

    // ---- classification ----
    let model = await draftModel(page);
    const byName = Object.fromEntries(model.rows.map((r) => [r.name, r]));
    assert(byName["Barbell back squat"].status === "exact", "an exact name links itself",
      JSON.stringify(byName["Barbell back squat"]));
    assert(
      byName["Puxada frontal na máquina pegada neutra"].status === "alias" && byName["Puxada frontal na máquina pegada neutra"].match === PULLDOWN_NEUTRAL,
      "the same movement in the other language is matched",
      JSON.stringify(byName["Puxada frontal na máquina pegada neutra"])
    );
    assert(
      byName["Lat pulldown machine thing"].status === "probable" && !byName["Lat pulldown machine thing"].reviewed,
      "a likely match is proposed but not applied",
      JSON.stringify(byName["Lat pulldown machine thing"])
    );
    assert(
      byName["Zerbulator 9000"].status === "unmatched" && !byName["Zerbulator 9000"].reviewed,
      "a name the library does not know arrives undecided",
      JSON.stringify(byName["Zerbulator 9000"])
    );
    assert(
      byName["My gym row"].match === "custom:shared",
      "a definition travelling with the file resolves its own templates",
      JSON.stringify(byName["My gym row"])
    );
    assert(await page.locator("#importCommit").isDisabled(), "Import stays blocked while rows need review");

    // ---- a settled row folds its alternatives away ----
    // Most settled rows were matched by the importer, not chosen by the lifter.
    // Carrying three alternatives each turns the screen you read before
    // replacing a program into a wall of controls, so a settled row shows one
    // way back in and keeps everything that identifies it.
    const foldShape = await page.evaluate(() => {
      const shape = (name) => {
        const row = [...document.querySelectorAll("#importRows .improw")]
          .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === name);
        if (!row) return null;
        return {
          folded: row.classList.contains("is-folded"),
          acts: [...row.querySelectorAll("[data-imp-act]")].map((b) => b.dataset.impAct),
          changeLabel: row.querySelector('[data-imp-act="expand"]')?.textContent?.trim() || "",
          keepsIdentity: !!row.querySelector(".improw__from") && !!row.querySelector(".improw__name") &&
            !!row.querySelector(".impbadge.is-done"),
        };
      };
      return { settled: shape("Puxada frontal na máquina pegada neutra"), pending: shape("Zerbulator 9000") };
    });
    assert(
      foldShape.settled?.folded &&
        JSON.stringify(foldShape.settled.acts) === JSON.stringify(["expand"]) &&
        foldShape.settled.changeLabel.length > 0 &&
        foldShape.settled.keepsIdentity,
      "a settled row shows one Change action and still reads as itself",
      JSON.stringify(foldShape.settled)
    );
    assert(
      foldShape.pending && !foldShape.pending.folded &&
        foldShape.pending.acts.includes("choose") && foldShape.pending.acts.includes("custom"),
      "a row still needing a decision keeps every action on screen",
      JSON.stringify(foldShape.pending)
    );

    const expanded = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal na máquina pegada neutra");
      row.querySelector('[data-imp-act="expand"]').click();
      const now = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal na máquina pegada neutra");
      return {
        acts: [...now.querySelectorAll("[data-imp-act]")].map((b) => b.dataset.impAct),
        stillFolded: now.classList.contains("is-folded"),
        focusedAct: document.activeElement?.getAttribute("data-imp-act"),
        focusedRow: document.activeElement?.closest(".improw")?.querySelector(".improw__from")?.textContent?.trim(),
      };
    });
    assert(
      !expanded.stillFolded && expanded.acts.includes("choose") && expanded.acts.includes("custom") &&
        !expanded.acts.includes("expand"),
      "Change reopens the alternatives on that row",
      JSON.stringify(expanded)
    );
    assert(
      expanded.focusedAct && expanded.focusedRow === "Puxada frontal na máquina pegada neutra",
      "Change moves focus onto the controls it reveals",
      JSON.stringify(expanded)
    );
    model = await draftModel(page);
    assert(
      model.rows.find((r) => r.name === "Puxada frontal na máquina pegada neutra")?.reviewed === true && model.counts.review === 2,
      "reopening a settled row does not push it back onto the review list",
      JSON.stringify(model.counts)
    );

    await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal na máquina pegada neutra");
      row.querySelector('[data-imp-act="choose"]').click();
    });
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.fill("#exPickSearch", "Overhand grip cable lat pulldown");
    await page.locator(`#exPickList [data-pick="${PULLDOWN_OVERHAND}"]`).click();
    await page.waitForSelector("#exPickSheet.is-open", { state: "detached", timeout: 5000 });
    await settle(page, 200);
    const refolded = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal na máquina pegada neutra");
      return { folded: row.classList.contains("is-folded"), acts: [...row.querySelectorAll("[data-imp-act]")].map((b) => b.dataset.impAct) };
    });
    model = await draftModel(page);
    assert(
      refolded.folded && JSON.stringify(refolded.acts) === JSON.stringify(["expand"]) &&
        model.rows.find((r) => r.name === "Puxada frontal na máquina pegada neutra")?.decision === "link" &&
        model.rows.find((r) => r.name === "Puxada frontal na máquina pegada neutra")?.match === PULLDOWN_OVERHAND,
      "choosing from a reopened row applies the change and folds it back",
      JSON.stringify({ refolded, decision: model.rows.find((r) => r.name === "Puxada frontal na máquina pegada neutra")?.decision })
    );

    // ---- cancelling writes nothing ----
    await page.click("#importReviewCancel");
    await settle(page);
    after = await getState(page);
    assert(
      JSON.stringify(after.program) === JSON.stringify(before.program),
      "cancelling an import leaves the program alone",
      `${after.program.length} rows`
    );

    // ---- reviewing, then committing ----
    await openEditor(page);
    await importFile(page, "split.json", v3);
    await page.evaluate(() => {
      // Accept the proposed match on one row.
      const rows = [...document.querySelectorAll("#importRows .improw")];
      for (const row of rows) {
        const from = row.querySelector(".improw__from")?.textContent?.trim();
        if (from === "Lat pulldown machine thing")
          row.querySelector('[data-imp-act="pick"][data-imp-idx="0"], [data-imp-act="link"]')?.click();
      }
    });
    await settle(page, 200);
    // The name the catalog does not know is resolved by choosing the movement
    // it means from the library.
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Zerbulator 9000");
      row.querySelector('[data-imp-act="choose"]').click();
    });
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.fill("#exPickSearch", "Bent-over barbell row");
    await page.locator(`#exPickList [data-pick="${BENT_OVER_ROW}"]`).click();
    await page.waitForSelector("#exPickSheet.is-open", { state: "detached", timeout: 5000 }).catch(() => {});
    await settle(page, 200);
    model = await draftModel(page);
    assert(model.rows.find((r) => r.name === "Zerbulator 9000")?.match === BENT_OVER_ROW &&
      model.rows.find((r) => r.name === "Zerbulator 9000")?.decision === "link",
    "choosing from the library links the row to the movement picked", JSON.stringify(model.rows));
    assert(model.counts.review === 0, "reviewing every row unblocks Import", JSON.stringify(model.counts));
    assert(!(await page.locator("#importCommit").isDisabled()), "the Import button enables once nothing is pending");

    const activeBeforeReview = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await stageReviewedImport(page);
    assert(await page.evaluate(() => document.activeElement?.id === "entryHeading"),
      "valid imported preview focuses its heading on initial render");
    const stagedImport = await page.evaluate(({ activeKey, draftKey }) => ({
      active: localStorage.getItem(activeKey),
      draft: JSON.parse(localStorage.getItem(draftKey) || "null"),
    }), { activeKey: KEY, draftKey: SETUP_DRAFT });
    assert(stagedImport.active === activeBeforeReview,
      "reviewing the mapped import leaves active state byte-identical");
    assert(stagedImport.draft?.state?.route === "import" && stagedImport.draft.state.step === "preview" &&
      stagedImport.draft.state.result?.preview?.program?.length === 5,
    "the reviewed import persists as an owned setup candidate", JSON.stringify(stagedImport.draft));
    const stagedPreview = stagedImport.draft?.state?.result?.preview;
    assert(definitionSlots(stagedPreview?.programDefinition).length === 5 &&
      JSON.stringify(definitionSlots(stagedPreview.programDefinition).map((slot) => slot.exerciseId)) ===
        JSON.stringify(stagedPreview.program.map((row) => row.libraryId)),
    "the reviewed candidate is a canonical program whose rows are its projection",
    JSON.stringify(stagedPreview?.programDefinition));
    assert(!(await page.locator("#entryActivate").isDisabled()),
      "a fully reviewed import is activation-ready");
    await activateStagedImport(page);
    after = await getState(page);
    assert(after.program.length === 5, "explicit activation writes the reviewed program", `${after.program.length} rows`);
    const activeSlots = definitionSlots(after.programMeta.programDefinition);
    assert(
      activeSlots.length === 5 &&
        JSON.stringify(activeSlots.map((slot) => slot.exerciseId)) === JSON.stringify(after.program.map((e) => e.libraryId)),
      "activation persists the canonical definition the rows project from",
      JSON.stringify({ slots: activeSlots.map((slot) => [slot.id, slot.exerciseId]), rows: after.program.map((e) => [e.id, e.libraryId]) })
    );
    assert(
      activeSlots.find((slot) => slot.id === "slot-heavy")?.exerciseId === BACK_SQUAT &&
        activeSlots.find((slot) => slot.id === "slot-volume")?.exerciseId === PULLDOWN_NEUTRAL,
      "a row's own id from the file becomes its slot id",
      JSON.stringify(activeSlots.map((slot) => [slot.id, slot.exerciseId]))
    );
    const squat = after.program.find((e) => e.libraryId === BACK_SQUAT);
    const alias = after.program.find((e) => e.libraryId === PULLDOWN_NEUTRAL);
    const probable = after.program.find((e) => e.libraryId === PULLDOWN_OVERHAND && e.day === "Day 1" && e.order === 3);
    const picked = after.program.find((e) => e.libraryId === BENT_OVER_ROW && e.day === "Day 2");
    const rowsSeen = JSON.stringify(after.program.map((e) => [e.day, e.order, e.name, e.libraryId]));
    assert(!!squat && squat.min === 5 && squat.max === 8 && squat.sets === 3,
      "an exact row lands linked with its sets and rep range", rowsSeen);
    assert(!!alias, "a row named in the other language lands linked to that movement", rowsSeen);
    assert(!!probable, "an accepted likely match lands linked", rowsSeen);
    assert(!!picked, "a row resolved from the library lands linked to the movement picked", rowsSeen);

    // ---- v3 portability ----
    const custom = (after.customExercises || []).find((e) => e.id === "custom:shared");
    const linkedToCustom = after.program.find((e) => e.libraryId === "custom:shared");
    assert(!!custom, "a referenced custom definition is imported with the program",
      JSON.stringify(after.customExercises));
    assert(
      !!linkedToCustom && custom.primary === "Mid/upper back" &&
        activeSlots.some((slot) => slot.exerciseId === "custom:shared" && slot.metricOrigin === "user_defined"),
      "the imported template resolves against the imported definition",
      JSON.stringify([linkedToCustom?.name, custom?.primary])
    );

    // Exporting again carries it back out.
    const exported = await page.evaluate(() => {
      const program = JSON.parse(localStorage.getItem("repforge_v1")).program;
      return window.__repforgeReferencedCustom(program);
    });
    assert(
      exported.length === 1 && exported[0].id === "custom:shared",
      "export carries exactly the definitions the program references",
      JSON.stringify(exported)
    );
    await openEditor(page);
    const programJson = await downloadJson(page, "#exportProgram");
    assert(
      programJson.kind === "taurifer-program" && programJson.version === 4 &&
        programJson.name === "Imported split" &&
        JSON.stringify(programJson.definition) === JSON.stringify(after.programMeta.programDefinition) &&
        JSON.stringify((programJson.customExercises || []).map((e) => e.id)) === JSON.stringify(["custom:shared"]),
      "program JSON export carries the canonical definition and the custom movements it references",
      JSON.stringify({ kind: programJson.kind, version: programJson.version, customs: programJson.customExercises })
    );
    const parsedProgramJson = await page.evaluate((value) => window.__repforgeParseProgramSource(value, "program.json"), JSON.stringify(programJson));
    assert(
      JSON.stringify(parsedProgramJson?.definition) === JSON.stringify(programJson.definition) &&
        parsedProgramJson?.exercises?.length === 5 &&
        JSON.stringify(parsedProgramJson.exercises.map((e) => e.libraryId)) === JSON.stringify(after.program.map((e) => e.libraryId)),
      "program JSON import reads the exported definition back exactly",
      JSON.stringify(parsedProgramJson)
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await getState(page);
    assert(
      JSON.stringify(reloaded.programMeta.programDefinition) === JSON.stringify(after.programMeta.programDefinition) &&
        JSON.stringify(reloaded.program.map((e) => e.libraryId)) === JSON.stringify(after.program.map((e) => e.libraryId)),
      "durable reload preserves the imported definition",
      JSON.stringify({ program: reloaded.program, meta: reloaded.programMeta })
    );
    const archived = await page.evaluate(async () => {
      const oldId = JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.id;
      const result = await window.__repforgeCommitNextBlock("repeat");
      const snapshot = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const entry = snapshot.programHistory?.find((item) => item.id === oldId);
      return { result, entry, oldId, activeProgram: snapshot.program, activeMeta: snapshot.programMeta };
    });
    assert(
      archived.result?.committed && !archived.entry &&
        JSON.stringify(definitionSlots(archived.activeMeta?.programDefinition).map((slot) => slot.exerciseId)) ===
          JSON.stringify(activeSlots.map((slot) => slot.exerciseId)),
      "a repeated block keeps the imported definition without an archive",
      JSON.stringify({ result: archived.result, entry: archived.entry, meta: archived.activeMeta })
    );

    // A released program file may still carry a retired progression envelope.
    // It is not part of the canonical model, so the candidate must not carry it
    // anywhere executable.
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "legacy-progression.json", JSON.stringify({
      version: 3, meta: { name: "Legacy progression" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8,
        progression: { schemaVersion: 1, strategy: { id: "future_strategy", version: 99, params: { authored: true } }, modifiers: [] } }],
    }));
    model = await draftModel(page);
    assert(model?.counts.total === 1 && model.counts.review === 0,
      "a file carrying a retired progression envelope reaches the review", JSON.stringify(model?.counts));
    await stageReviewedImport(page);
    const legacyCandidate = await page.evaluate(() => window.__repforgeOnboarding.entry().result?.preview);
    assert(legacyCandidate?.program?.length === 1 && legacyCandidate.program[0].progression === undefined &&
      !JSON.stringify(legacyCandidate.programDefinition || null).includes("future_strategy") &&
      definitionSlots(legacyCandidate.programDefinition)[0]?.exerciseId === BENCH_PRESS,
    "a retired progression envelope is not carried into the canonical candidate",
    JSON.stringify(legacyCandidate));

    const oversizedMeta = await page.evaluate(() => window.__repforgeValidateStateShape({
      program: [{ id: "ex1", name: "Press", day: "Day 1", order: 1, sets: 3, min: 6, max: 10 }], log: [],
      programMeta: { progressionIncompatibilities: [{ value: { text: "x".repeat(4001) } }] },
    }));
    assert(oversizedMeta === false,
      "oversized progression incompatibility metadata is rejected before backup normalization");

    // ---- an id collision must not overwrite a different local definition ----
    // Seeded through the app so the write goes through the durability layer
    // rather than racing the IndexedDB mirror.
    await reset(page);
    const localId = await page.evaluate(async () => {
      const r = await window.__repforgeSaveCustomExercise({
        name: "Something else entirely", equipment: ["cable"], primary: "Chest", secondary: "" });
      return r.entry?.id || null;
    });
    assert(!!localId, "seeded a local custom definition", String(localId));
    await settle(page, 700);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const colliding = JSON.parse(v3);
    // The file claims the id the local definition already holds, for a
    // different movement — two devices minting ids independently.
    colliding.customExercises[0].id = localId;
    colliding.exercises.find((e) => e.libraryId === "custom:shared").libraryId = localId;
    // Every remaining row resolves to a movement on its own or by its first proposal.
    colliding.exercises = colliding.exercises.filter((e) => e.name !== "Zerbulator 9000");
    await importFile(page, "split.json", JSON.stringify(colliding));
    await acceptFirstProposals(page);
    await stageReviewedImport(page);
    const collisionCandidate = await page.evaluate(() => window.__repforgeOnboarding.entry().result.preview);
    const stagedTheirs = (collisionCandidate.customExercises || []).find((e) => e.name === "My gym row");
    await activateStagedImport(page);
    after = await getState(page);
    const mine = (after.customExercises || []).find((e) => e.name === "Something else entirely");
    const theirs = (after.customExercises || []).find((e) => e.name === "My gym row");
    assert(
      mine && mine.id === localId && mine.primary === "Chest",
      "a colliding import does not overwrite the local definition",
      JSON.stringify(after.customExercises?.map((e) => [e.id, e.name]))
    );
    assert(
      stagedTheirs && theirs && theirs.id === stagedTheirs.id && theirs.id !== localId,
      "explicit activation installs the imported definition under its fresh id",
      JSON.stringify([theirs?.id, theirs?.name])
    );
    assert(
      after.program.some((e) => e.libraryId === theirs?.id),
      "explicit activation keeps templates pointed at the remapped definition",
      JSON.stringify(after.program.map((e) => [e.name, e.libraryId]))
    );

    // ---- an unknown row must become a movement before Import ----
    // Every program slot names a movement, so a row the catalog does not know
    // is settled by choosing a movement or creating one. There is no unlinked
    // "keep as typed" that would stage a preview that can never activate.
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "unknown.json", JSON.stringify({
      version: 3, meta: { name: "Unknown row" },
      exercises: [
        { day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 },
        { day: "Day 1", order: 2, name: "Zerbulator 9000", sets: 3, min: 8, max: 12 },
      ],
    }));
    const activeBeforeUnknown = await page.evaluate((key) => localStorage.getItem(key), KEY);
    const unknownActs = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Zerbulator 9000");
      return [...(row?.querySelectorAll("[data-imp-act]") || [])].map((b) => b.dataset.impAct);
    });
    assert(unknownActs.includes("choose") && unknownActs.includes("custom") && !unknownActs.includes("raw"),
      "an unknown row offers Choose and Create custom, not keep-as-typed", JSON.stringify(unknownActs));
    assert(await page.locator("#importCommit").isDisabled(),
      "Import stays blocked until the unknown row names a movement");
    assert(await page.evaluate(({ key, before }) => localStorage.getItem(key) === before, { key: KEY, before: activeBeforeUnknown }),
      "an undecided unknown row changes nothing durable");

    // ---- older and simpler shapes still import ----
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "v2.json", JSON.stringify({
      version: 2, meta: { name: "Old export" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 }],
    }));
    model = await draftModel(page);
    assert(model && model.counts.total === 1, "a version 2 file still imports", JSON.stringify(model?.counts));
    await reviewAndActivateImport(page);
    after = await getState(page);
    assert(
      after.program.length === 1 && after.program[0].libraryId === BENCH_PRESS &&
        definitionSlots(after.programMeta.programDefinition)[0]?.exerciseId === BENCH_PRESS,
      "the v2 program lands linked",
      JSON.stringify(after.program)
    );

    // ---- the app's own text export ----
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "upper-lower.txt",
      "UPPER / LOWER, 2 days per week\n\nDAY 1: Chest · Back\n1. Barbell bench press: 4× 4 to 8\n2. Bent-over barbell row: 3× 6 to 10\n\nDAY 2: Legs\n1. 45° leg press: 3× 8 to 12\n");
    model = await draftModel(page);
    assert(
      model && model.format === "text" && model.counts.total === 3,
      "the app's own text export parses back",
      JSON.stringify(model?.counts)
    );
    assert(
      model.rows.every((r) => r.status === "exact"),
      "text rows match the library by name",
      JSON.stringify(model.rows.map((r) => [r.name, r.status]))
    );
    await reviewAndActivateImport(page);
    after = await getState(page);
    assert(
      after.program.length === 3 && after.program.filter((e) => e.day === "Day 1").length === 2,
      "the text import lands with its days and rep ranges",
      JSON.stringify(after.program.map((e) => [e.day, e.name, e.sets, e.min, e.max]))
    );
    assert(
      JSON.stringify(after.program.map((e) => [e.libraryId, e.sets, e.min, e.max])) === JSON.stringify([
        [BENCH_PRESS, 4, 4, 8], [BENT_OVER_ROW, 3, 6, 10], [LEG_PRESS_45, 3, 8, 12],
      ]) && definitionSlots(after.programMeta.programDefinition).length === 3,
      "the text import lands as a canonical program over the movements it names",
      JSON.stringify(after.program.map((e) => [e.name, e.libraryId, e.sets, e.min, e.max]))
    );
    assert(
      after.programMeta.name === "Upper / Lower",
      "a text-export header restores the program title without its days-per-week suffix",
      after.programMeta.name
    );

    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "legacy.txt",
      "LEGACY (1 day per week)\n\nDAY 1 — Chest\n1. Barbell bench press — 4× 4-8\n");
    model = await draftModel(page);
    assert(
      model && model.format === "text" && model.counts.total === 1,
      "the previous text-export format still parses",
      JSON.stringify(model?.counts)
    );

    // ---- onboarding import is one coherent state transition ----
    await reset(page);
    await page.evaluate(() => window.startOnboarding("first-run"));
    const onboardingImport = JSON.stringify({
      version: 3,
      meta: { name: "Atomic onboarding" },
      exercises: [
        { day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 },
        { day: "Day 1", order: 2, name: "My onboarding row", sets: 3, min: 8, max: 12,
          libraryId: "custom:onboarding" },
      ],
      customExercises: [
        { id: "custom:onboarding", name: "My onboarding row", equipment: ["machine"],
          primary: "Mid/upper back", secondary: "Biceps", ...WEIGHT_REPS },
      ],
    });
    await importFile(page, "onboarding.json", onboardingImport);
    model = await draftModel(page);
    const onboardingDraft = await page.evaluate(() => ({
      origin: window.__repforgeOnboardingOrigin?.(),
      commitDisabled: document.querySelector("#importCommit")?.disabled,
    }));
    assert(model?.counts.review === 0 && onboardingDraft.origin === "first-run" && !onboardingDraft.commitDisabled,
      "an onboarding import reaches the same reviewed draft", JSON.stringify(onboardingDraft));
    const activeBeforeOnboardingImport = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await stageReviewedImport(page);
    const atomicCandidate = await page.evaluate(({ activeKey, setupKey }) => {
      const active = localStorage.getItem(activeKey);
      const draft = JSON.parse(localStorage.getItem(setupKey) || "null");
      const preview = draft?.state?.result?.preview;
      return {
        active,
        route: draft?.state?.route,
        step: draft?.state?.step,
        coherent: preview?.customExercises?.some((e) => e.id === "custom:onboarding") &&
          preview?.program?.some((e) => e.libraryId === "custom:onboarding"),
      };
    }, { activeKey: KEY, setupKey: SETUP_DRAFT });
    assert(atomicCandidate.active === activeBeforeOnboardingImport && atomicCandidate.route === "import" &&
      atomicCandidate.step === "preview" && atomicCandidate.coherent,
    "onboarding stages the imported custom definition and program together",
    JSON.stringify(atomicCandidate));
    await activateStagedImport(page);
    const atomicActive = await getState(page);
    assert(atomicActive.customExercises?.some((e) => e.id === "custom:onboarding") &&
      atomicActive.program?.some((e) => e.libraryId === "custom:onboarding") &&
      atomicActive.programMeta?.name === "Atomic onboarding",
    "explicit activation persists the imported custom definition and program atomically",
    JSON.stringify({ customExercises: atomicActive.customExercises, program: atomicActive.program,
      name: atomicActive.programMeta?.name }));

    // Candidate edits must keep the fingerprint and carried definitions bound
    // to the program that will actually activate.
    await reset(page);
    await importFile(page, "editable-custom.json", JSON.stringify({
      version: 3,
      meta: { name: "Editable import" },
      exercises: [
        { id: "keep-row", day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 },
        { id: "remove-row", day: "Day 1", order: 2, name: "Orphan candidate row", sets: 3, min: 8, max: 12,
          libraryId: "custom:orphan" },
      ],
      customExercises: [{ id: "custom:orphan", name: "Orphan candidate row", equipment: ["machine"],
        primary: "Chest", secondary: "Triceps", ...WEIGHT_REPS }],
    }));
    await stageReviewedImport(page);
    const editableBefore = await page.evaluate((key) => ({
      active: localStorage.getItem(key),
      fingerprint: window.__repforgeOnboarding.entry().result.fingerprint,
    }), KEY);
    await page.click("#entryEdit");
    const orphanRow = page.locator('#onbProgramEditor [data-role="exercise"][data-id="remove-row"]');
    if (!(await orphanRow.locator('[data-role="remove-exercise"]').isVisible()))
      await orphanRow.locator('[data-role="toggle-exercise"]').click();
    await orphanRow.locator('[data-role="remove-exercise"]').click();
    await settle(page, 500);
    const editableAfter = await page.evaluate((key) => ({
      active: localStorage.getItem(key),
      result: window.__repforgeOnboarding.entry().result,
    }), KEY);
    assert(editableAfter.active === editableBefore.active,
      "deleting an imported custom row edits only the setup candidate");
    assert(editableAfter.result.preview.program.every((exercise) => exercise.libraryId !== "custom:orphan") &&
      editableAfter.result.preview.customExercises.length === 0,
    "candidate edits drop imported custom definitions after their final reference is removed",
    JSON.stringify(editableAfter.result.preview));
    assert(editableAfter.result.fingerprint !== editableBefore.fingerprint,
      "candidate edits recompute the semantic fingerprint",
      JSON.stringify([editableBefore.fingerprint, editableAfter.result.fingerprint]));

    // ---- prose is rejected, not guessed at ----
    const prose = await page.evaluate(() =>
      window.__repforgeParseProgramSource("Do some squats and then maybe a few curls, whatever feels good", "notes.txt"));
    assert(prose === null, "arbitrary prose is refused rather than invented into a program", JSON.stringify(prose));
    const malformedRow = await page.evaluate(() =>
      window.__repforgeParseProgramSource(JSON.stringify({
        exercises: [{ day: "Day 1", order: 1, name: "Press", sets: 3, min: "bad", repLow: 6, max: 10 }],
      }), "malformed.json"));
    assert(malformedRow === null, "malformed canonical bounds are rejected instead of defaulted", JSON.stringify(malformedRow));

    // ---- a full backup is not a program file ----
    // The sessions in the file are the whole point of a backup. Reading only
    // its exercises threw them away silently, which is indistinguishable from
    // a restore that worked until you open History and it is empty.
    // A backup is the app's own state: the canonical program, its metadata
    // and the log.
    const backup = JSON.stringify({
      settings: { unit: "kg", restSec: 180 },
      programMeta: seedProgramMeta({ id: "backup-meta", name: "Restored split", started: "2026-06-15" }),
      program: seedProgram(),
      log: [
        { session: "2026-06-15_Day 1_a", date: "2026-06-15", day: "Day 1", name: "Hack squat", set: 1, load: 100, reps: 8, rir: 2 },
        { session: "2026-06-15_Day 1_a", date: "2026-06-15", day: "Day 1", name: "Hack squat", set: 2, load: 100, reps: 7, rir: 1 },
        { session: "2026-06-18_Day 1_b", date: "2026-06-18", day: "Day 1", name: "Hack squat", set: 1, load: 102.5, reps: 8, rir: 2 },
      ],
      programHistory: [],
    });
    const SEED_ROWS = seedProgram().length;
    const seedDefinition = seedProgramMeta().programDefinition;
    const dialogState = () => page.evaluate(() => ({
      open: !!document.querySelector("#importChoice").open,
      body: document.querySelector("#importChoiceBody")?.textContent || "",
      programOnly: !document.querySelector("#importProgramOnly").classList.contains("hidden"),
      reviewing: document.body.classList.contains("is-import"),
    }));

    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "backup.json", backup);
    let choice = await dialogState();
    assert(choice.open && !choice.reviewing,
      "a backup opens the restore choice instead of the program review", JSON.stringify(choice));
    assert(choice.programOnly, "the program-only import this door promised is still offered", JSON.stringify(choice));
    assert(/2 sessions and 3 sets/.test(choice.body),
      "the choice names the sessions the file is carrying", choice.body);

    // Replace restores the whole install, log included.
    await page.evaluate(() => document.querySelector("#importReplace").click());
    await settle(page, 900);
    let restored = await getState(page);
    assert(new Set((restored.log || []).map((r) => r.session)).size === 2 && restored.log.length === 3,
      "restoring brings the recorded sessions with it",
      JSON.stringify({ sessions: new Set((restored.log || []).map((r) => r.session)).size, sets: restored.log?.length }));
    assert(restored.program?.length === SEED_ROWS &&
      JSON.stringify(restored.programMeta?.programDefinition) === JSON.stringify(seedDefinition),
    "restoring brings the program and its canonical definition too",
    JSON.stringify({ rows: restored.program?.length, meta: restored.programMeta }));
    assert(restored.settings?.restSec === 180, "restoring brings the settings too", JSON.stringify(restored.settings));

    // Merge takes the sessions without touching anything else.
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "backup.json", backup);
    await page.evaluate(() => document.querySelector("#importMerge").click());
    await settle(page, 900);
    restored = await getState(page);
    assert(new Set((restored.log || []).map((r) => r.session)).size === 2,
      "merging from this door brings the sessions", JSON.stringify(restored.log?.length));

    // Program only is still there for a lifter who wants the split alone.
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "backup.json", backup);
    await page.evaluate(() => document.querySelector("#importProgramOnly").click());
    await settle(page, 500);
    assert((await dialogState()).reviewing, "program only opens the review screen");
    await acceptFirstProposals(page);
    await reviewAndActivateImport(page);
    restored = await getState(page);
    assert(restored.program?.length === SEED_ROWS && (restored.log || []).length === 0,
      "program only imports the exercises and leaves history alone",
      JSON.stringify({ program: restored.program?.length, log: restored.log?.length }));
    assert(
      JSON.stringify(definitionSlots(restored.programMeta?.programDefinition).map((slot) => slot.exerciseId)) ===
        JSON.stringify(definitionSlots(seedDefinition).map((slot) => slot.exerciseId)),
      "program-only import keeps every movement the backup's program names",
      JSON.stringify(restored.program?.map((e) => [e.name, e.libraryId]))
    );

    // ---- a backup with no sessions is still a backup ----
    // It was read as a plain program file, so a lifter restoring onto a fresh
    // install got their exercises and silently lost everything else the file
    // was carrying: the language, the rest timer, the RIR mode, and the
    // program's own name, dates and block. An empty log is not consent.
    const freshBackup = JSON.stringify({
      settings: { unit: "lb", restSec: 180, rirMode: "effort", lang: "pt", jumpPct: 5 },
      programMeta: seedProgramMeta({
        id: "fresh-meta", name: "Projeto novo", started: "2026-07-01",
        equipment: ["machines"], mesocycleLengthWeeks: 8, onboarded: true,
      }),
      program: seedProgram(),
      log: [],
      programHistory: [],
    });

    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "empty-log.json", freshBackup);
    choice = await dialogState();
    assert(choice.open && !choice.reviewing,
      "a backup carrying no sessions still opens the restore choice", JSON.stringify(choice));
    assert(choice.programOnly, "the program-only import stays on the table for it", JSON.stringify(choice));
    const noLogButtons = await page.evaluate(() => ({
      merge: !document.querySelector("#importMerge").classList.contains("hidden"),
      replace: !document.querySelector("#importReplace").classList.contains("hidden"),
    }));
    assert(!noLogButtons.merge && noLogButtons.replace,
      "Merge is not offered for a file with no sessions to merge", JSON.stringify(noLogButtons));
    assert(!/\b0 sessions\b/.test(choice.body),
      "the choice states what the file holds instead of counting sessions it has none of", choice.body);

    await page.evaluate(() => document.querySelector("#importReplace").click());
    await settle(page, 900);
    restored = await getState(page);
    assert(restored.settings?.lang === "pt" && restored.settings?.restSec === 180 &&
      restored.settings?.rirMode === "effort" && restored.settings?.unit === "lb" &&
      restored.settings?.jumpPct === 5,
      "restoring a session-less backup brings its settings", JSON.stringify(restored.settings));
    assert(restored.programMeta?.name === "Projeto novo" && restored.programMeta?.id === "fresh-meta" &&
      restored.programMeta?.started === "2026-07-01" && restored.programMeta?.mesocycleLengthWeeks === 8,
      "restoring a session-less backup brings its program details", JSON.stringify(restored.programMeta));
    assert(restored.program?.length === SEED_ROWS, "restoring a session-less backup brings its program",
      JSON.stringify(restored.program?.length));

    // Program only is a partial import by choice — but the split's name is part
    // of the split, so it travels rather than being reinvented as "Untitled".
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "empty-log.json", freshBackup);
    await page.evaluate(() => document.querySelector("#importProgramOnly").click());
    await settle(page, 500);
    await acceptFirstProposals(page);
    await reviewAndActivateImport(page);
    restored = await getState(page);
    assert(restored.programMeta?.name === "Projeto novo",
      "program only carries the program's name out of a backup", JSON.stringify(restored.programMeta?.name));
    assert(restored.settings?.restSec !== 180 && restored.settings?.rirMode !== "effort",
      "program only leaves the settings on this device alone", JSON.stringify(restored.settings));

    // The setup gate's Import is the same door: a restore there has to restore,
    // not hand a new install its exercises and a fresh set of defaults.
    await reset(page);
    await page.evaluate(() => window.startOnboarding("first-run"));
    await importFile(page, "empty-log.json", freshBackup);
    choice = await dialogState();
    assert(choice.open && !choice.reviewing,
      "the setup gate's import offers the restore for a session-less backup", JSON.stringify(choice));
    await page.evaluate(() => document.querySelector("#importReplace").click());
    await settle(page, 900);
    restored = await getState(page);
    const gates = await page.evaluate(() => ({
      firstRun: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      onboarding: !!document.querySelector("#onboarding")?.classList.contains("active"),
    }));
    assert(restored.settings?.lang === "pt" && restored.programMeta?.name === "Projeto novo",
      "restoring from the setup gate keeps the settings and the program name",
      JSON.stringify({ settings: restored.settings, meta: restored.programMeta }));
    assert(!gates.firstRun && !gates.onboarding,
      "a restore answers the setup gate it came through", JSON.stringify(gates));

    // ---- a backup from before the canonical program model ----
    // Flat rows without a ProgramDefinition cannot be restored as a program the
    // engine reads. The program door re-links its rows through review instead,
    // and the Settings restore refuses it with a way forward, writing nothing.
    const legacyMeta = seedProgramMeta({ id: "legacy-meta", name: "Old backup" });
    delete legacyMeta.programDefinition;
    const legacyBackup = JSON.stringify({
      settings: { unit: "kg", restSec: 150 }, programMeta: legacyMeta, program: seedProgram(),
      log: [{ session: "2026-05-01_Day 1_a", date: "2026-05-01", day: "Day 1", name: "Hack squat", set: 1, load: 90, reps: 8, rir: 2 }],
      programHistory: [],
    });
    await resetWithProgram(page);
    await openEditor(page);
    const beforeLegacy = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await importFile(page, "legacy-backup.json", legacyBackup);
    choice = await dialogState();
    assert(!choice.open && choice.reviewing,
      "a legacy backup through the program door goes to review, not to a restore", JSON.stringify(choice));
    await page.click("#importReviewCancel");
    await settle(page);
    const expectedLegacyToast = await page.evaluate(() => window.RepForgeI18n.t("toast.backup_legacy"));
    await page.setInputFiles("#importJson", { name: "legacy-backup.json", mimeType: "application/json", buffer: Buffer.from(legacyBackup) });
    await page.waitForFunction((text) => document.querySelector("#toast")?.textContent?.includes(text), expectedLegacyToast, { timeout: 5000 });
    choice = await dialogState();
    assert(!choice.open, "the Settings restore refuses a legacy backup instead of offering it", JSON.stringify(choice));
    assert(await page.evaluate(({ key, before }) => localStorage.getItem(key) === before, { key: KEY, before: beforeLegacy }),
      "refusing a legacy backup changes nothing durable");

    // A program-only file is still a program file: it has no log to speak for.
    await resetWithProgram(page);
    await openEditor(page);
    await importFile(page, "program.json", JSON.stringify({
      version: 3, meta: { name: "Just a program" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 }],
    }));
    choice = await dialogState();
    assert(!choice.open && choice.reviewing,
      "a program export goes straight to the review, as it always did", JSON.stringify(choice));
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nimport review: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
