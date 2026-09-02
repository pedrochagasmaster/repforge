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

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
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

async function stageReviewedImport(page) {
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  await settle(page, 200);
}

async function activateStagedImport(page) {
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.click("#entryActivate");
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

const v3 = JSON.stringify({
  version: 3,
  meta: {
    name: "Imported split",
    progressionRelations: [{
      schemaVersion: 1, id: "relation-import", type: "paired_exposure", version: 1,
      movementId: "movement:import-pair",
      members: [{ exerciseId: "slot-volume", role: "volume" }, { exerciseId: "slot-heavy", role: "heavy" }],
    }],
    progressionModifiers: [{ id: "modifier-import", version: 1, compatibleStrategies: ["range@1"], params: { pending: true } }],
    programStructure: {
      schemaVersion: 1,
      days: [{ dayId: "import_d1", label: "Day 1", order: 1 }, { dayId: "import_d2", label: "Day 2", order: 2 }],
      provenance: { familyId: "balanced", blueprintId: "balanced_2_v1", compilerVersion: 1, catalogueVersion: 1, rulesVersion: 1 },
      weekPrescriptions: [], customizedFrom: null,
    },
  },
  exercises: [
    { id: "slot-heavy", movementId: "movement:import-pair", day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8,
      progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 5, repMax: 8 } }, modifiers: [] } },
    { id: "slot-volume", movementId: "movement:import-pair", day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12,
      progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] } },
    { day: "Day 1", order: 3, name: "Lat pulldown machine thing", sets: 3, min: 8, max: 12 },
    { day: "Day 2", order: 1, name: "Zerbulator 9000", sets: 3, min: 8, max: 12 },
    { day: "Day 2", order: 2, name: "My gym row", sets: 3, min: 8, max: 12, libraryId: "custom:shared" },
  ],
  customExercises: [
    { id: "custom:shared", name: "My gym row", equipment: ["machine"], primary: "Mid/upper back", secondary: "Biceps" },
  ],
});

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await reset(page);
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
      byName["Puxada frontal"].status === "alias" && byName["Puxada frontal"].match === "pd_mc",
      "the same movement in the other language is matched",
      JSON.stringify(byName["Puxada frontal"])
    );
    assert(
      byName["Lat pulldown machine thing"].status === "probable" && !byName["Lat pulldown machine thing"].reviewed,
      "a likely match is proposed but not applied",
      JSON.stringify(byName["Lat pulldown machine thing"])
    );
    assert(
      byName["Zerbulator 9000"].status === "unmatched" && byName["Zerbulator 9000"].decision === "raw",
      "a name the library does not know is kept as imported",
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
      return { settled: shape("Puxada frontal"), pending: shape("Zerbulator 9000") };
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
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal");
      row.querySelector('[data-imp-act="expand"]').click();
      const now = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal");
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
      expanded.focusedAct && expanded.focusedRow === "Puxada frontal",
      "Change moves focus onto the controls it reveals",
      JSON.stringify(expanded)
    );
    model = await draftModel(page);
    assert(
      model.rows.find((r) => r.name === "Puxada frontal")?.reviewed === true && model.counts.review === 2,
      "reopening a settled row does not push it back onto the review list",
      JSON.stringify(model.counts)
    );

    await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal");
      row.querySelector('[data-imp-act="raw"]').click();
    });
    await settle(page, 200);
    const refolded = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")]
        .find((r) => r.querySelector(".improw__from")?.textContent?.trim() === "Puxada frontal");
      return { folded: row.classList.contains("is-folded"), acts: [...row.querySelectorAll("[data-imp-act]")].map((b) => b.dataset.impAct) };
    });
    model = await draftModel(page);
    assert(
      refolded.folded && JSON.stringify(refolded.acts) === JSON.stringify(["expand"]) &&
        model.rows.find((r) => r.name === "Puxada frontal")?.decision === "raw",
      "choosing from a reopened row applies the change and folds it back",
      JSON.stringify({ refolded, decision: model.rows.find((r) => r.name === "Puxada frontal")?.decision })
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
      // Accept the proposed match on one, keep the other as imported.
      const rows = [...document.querySelectorAll("#importRows .improw")];
      for (const row of rows) {
        const from = row.querySelector(".improw__from")?.textContent?.trim();
        if (from === "Lat pulldown machine thing") row.querySelector('[data-imp-act="link"]')?.click();
      }
    });
    await settle(page, 200);
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#importRows .improw")];
      for (const row of rows) {
        const from = row.querySelector(".improw__from")?.textContent?.trim();
        if (from === "Zerbulator 9000") row.querySelector('[data-imp-act="raw"]')?.click();
      }
    });
    await settle(page, 200);
    model = await draftModel(page);
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
    const manualProgressionCopy = await page.locator("#onbBody").innerText();
    assert(/program or you set each exercise's target/i.test(manualProgressionCopy) &&
      !/supported Taurifer progression/i.test(manualProgressionCopy),
    "common import preview explains that authored manual targets belong to the program or user",
    manualProgressionCopy);
    assert(!(await page.locator("#entryActivate").isDisabled()),
      "an authored manual progression remains activation-ready after review");
    await activateStagedImport(page);
    after = await getState(page);
    assert(after.program.length === 5, "explicit activation writes the reviewed program", `${after.program.length} rows`);
    assert(
      after.program.find((e) => e.id === "slot-heavy")?.progression?.strategy?.id === "range" &&
        after.program.find((e) => e.id === "slot-volume")?.progression?.strategy?.id === "manual",
      "program import persists recognized progression envelopes",
      JSON.stringify(after.program.filter((e) => ["slot-heavy", "slot-volume"].includes(e.id)))
    );
    assert(
      after.programMeta.progressionRelations?.[0]?.id === "relation-import" &&
        after.programMeta.progressionRelations[0].members[0].role === "heavy" &&
        after.programMeta.progressionModifiers?.[0]?.id === "modifier-import" &&
        after.programMeta.programStructure?.provenance?.blueprintId === "balanced_2_v1",
      "program import persists contextual relations, modifiers, and compiler provenance",
      JSON.stringify({ relations: after.programMeta.progressionRelations, modifiers: after.programMeta.progressionModifiers })
    );
    const squat = after.program.find((e) => e.libraryId === "sq_bb");
    const probable = after.program.find((e) => e.libraryId === "pd_mc" && e.day === "Day 1" && e.order === 3);
    const raw = after.program.find((e) => e.name === "Zerbulator 9000");
    assert(!!squat, "an exact row lands linked");
    assert(!!probable, "an accepted likely match lands linked", JSON.stringify(after.program.map((e) => [e.name, e.libraryId])));
    assert(raw && raw.libraryId === undefined, "a row kept as imported lands with its own name and no link", JSON.stringify(raw));

    // ---- v3 portability ----
    const custom = (after.customExercises || []).find((e) => e.id === "custom:shared");
    const linkedToCustom = after.program.find((e) => e.libraryId === "custom:shared");
    assert(!!custom, "a referenced custom definition is imported with the program",
      JSON.stringify(after.customExercises));
    assert(
      !!linkedToCustom && custom.primary === "Mid/upper back",
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
      programJson.version === 3 && programJson.exercises.find((e) => e.id === "slot-heavy")?.progression?.strategy?.id === "range" &&
        programJson.meta?.progressionRelations?.[0]?.id === "relation-import",
      "program JSON export carries the progression model",
      JSON.stringify({ version: programJson.version, exercise: programJson.exercises.find((e) => e.id === "slot-heavy"), meta: programJson.meta })
    );
    const parsedProgramJson = await page.evaluate((value) => window.__repforgeParseProgramSource(value, "program.json"), JSON.stringify(programJson));
    assert(
      parsedProgramJson?.meta?.progressionModifiers?.[0]?.id === "modifier-import" &&
        parsedProgramJson?.exercises?.[0]?.progression?.strategy?.id === "range" &&
        parsedProgramJson?.meta?.programStructure?.provenance?.blueprintId === "balanced_2_v1",
      "program JSON import reads the versioned progression model",
      JSON.stringify(parsedProgramJson)
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await getState(page);
    assert(
      reloaded.program.find((e) => e.id === "slot-heavy")?.progression?.strategy?.id === "range" &&
        reloaded.programMeta.progressionRelations?.[0]?.id === "relation-import" &&
        reloaded.programMeta.progressionModifiers?.[0]?.id === "modifier-import" &&
        reloaded.programMeta.programStructure?.provenance?.blueprintId === "balanced_2_v1",
      "durable reload preserves the progression model",
      JSON.stringify({ program: reloaded.program, meta: reloaded.programMeta })
    );
    const archived = await page.evaluate(async () => {
      const oldId = JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.id;
      const result = await window.__repforgeCommitNextBlock("repeat");
      const snapshot = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const entry = snapshot.programHistory?.find((item) => item.id === oldId);
      return { result, entry, oldId };
    });
    assert(
      archived.result?.committed && archived.entry?.program?.find((e) => e.id === "slot-heavy")?.progression?.strategy?.id === "range" &&
        archived.entry?.meta?.progressionRelations?.[0]?.id === "relation-import" &&
        archived.entry?.meta?.programStructure?.provenance?.blueprintId === "balanced_2_v1",
      "archived program history preserves the progression model",
      JSON.stringify(archived)
    );

    // An editor import may carry a future prescription, but it must never make
    // that unvalidated value executable. The explicit incompatibility marker
    // keeps the original data recoverable for a later reader.
    await reset(page);
    await openEditor(page);
    await importFile(page, "future-progression.json", JSON.stringify({
      version: 3, meta: { name: "Future progression" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8,
        progression: { schemaVersion: 1, strategy: { id: "future_strategy", version: 99, params: { authored: true } }, modifiers: [] } }],
    }));
    model = await draftModel(page);
    assert(model?.counts.total === 1 && model.counts.review === 0,
      "a future progression file reaches the editor review", JSON.stringify(model?.counts));
    const activeBeforeFuture = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await stageReviewedImport(page);
    assert(await page.evaluate(() => document.activeElement?.id === "entryActivationStatus"),
      "future-strategy import preview focuses its activation status on initial render");
    const futureCandidate = await page.evaluate(() => window.__repforgeOnboarding.entry());
    assert(futureCandidate.result?.preview?.program?.[0]?.progression === undefined &&
      futureCandidate.result.preview.program[0]?.progressionIncompatibility?.kind === "prescription" &&
      futureCandidate.result.preview.program[0]?.progressionIncompatibility?.value?.strategy?.id === "future_strategy",
      "program JSON review preserves unvalidated progression as non-executable provenance",
      JSON.stringify(futureCandidate.result?.preview?.program?.[0]));
    assert(await page.locator("#entryActivate").isDisabled(),
      "an import with unsupported progression disables activation until it is repaired");
    const blockedFuture = await page.evaluate(() => window.__repforgeActivateEntryPreview?.({ skipReplaceConfirm: true }));
    assert(blockedFuture?.code === "candidate_incomplete", "unsupported import exposes an actionable activation validation result",
      JSON.stringify(blockedFuture));
    assert(await page.evaluate(({ key, before }) => localStorage.getItem(key) === before,
      { key: KEY, before: activeBeforeFuture }),
    "an import with unsupported progression cannot replace active state");

    const legacyProgression = await page.evaluate(() => {
      const common = { id: "legacy-slot", movementId: "legacy-slot", name: "Legacy lift", sets: 3, min: 6, max: 10 };
      const project = (extra) => window.__repforgeProgressionForExercise({ ...common, ...extra });
      return {
        empty: project({ progressionType: "   " }),
        alias: project({ progressionType: "double_progression" }),
        unknown: project({ progressionType: "old_custom_rule" }),
        invalid: project({ progressionIncompatibility: { version: 1, kind: "prescription", reason: "future", value: { strategy: { id: "future", version: 9 } } } }),
      };
    });
    assert(legacyProgression.empty.strategy.id === "range" && legacyProgression.alias.strategy.id === "range",
      "empty and documented legacy progression markers project to range in memory",
      JSON.stringify(legacyProgression));
    assert(legacyProgression.unknown.strategy.id === "manual" &&
      legacyProgression.unknown.strategy.params.unsupportedImport === "old_custom_rule",
      "unknown legacy progression markers remain manual and preserve their reason",
      JSON.stringify(legacyProgression.unknown));
    assert(legacyProgression.invalid.strategy.id === "manual" &&
      legacyProgression.invalid.strategy.params.unsupportedImport === "incompatible_prescription",
      "invalid or future progression markers cannot reach the range adapter",
      JSON.stringify(legacyProgression.invalid));
    const legacyRecommendation = await page.evaluate(() => window.__repforgeRecommendation({
      id: "legacy-slot", movementId: "legacy-slot", name: "Legacy lift", day: "Day 1", sets: 3, min: 6, max: 10,
      progressionType: "old_custom_rule",
    }));
    assert(legacyRecommendation.status === "manual" && legacyRecommendation.load === null && legacyRecommendation.reason === "manual.unsupported_import",
      "unknown legacy progression produces no range recommendation target",
      JSON.stringify(legacyRecommendation));

    const manualSuggestions = await page.evaluate(() => {
      const ex = { id: "legacy-slot", movementId: "legacy-slot", name: "Legacy lift", day: "Day 1", sets: 3, min: 6, max: 10,
        progressionType: "old_custom_rule" };
      const rec = window.__repforgeProgression.recommendation(ex);
      return {
        suggestion: window.__repforgeProgression.setSuggestion(ex, 1, rec, {}, null),
        base: window.__repforgeProgression.baseSuggestion(ex, rec, {}, null),
        explanation: window.__repforgeProgression.explainRecommendation(ex),
      };
    });
    assert(manualSuggestions.suggestion.load === null && manualSuggestions.suggestion.reps === null,
      "manual progression does not invent ghost load or reps for a set",
      JSON.stringify(manualSuggestions.suggestion));
    assert(manualSuggestions.base.load === null && manualSuggestions.base.reps === null && manualSuggestions.explanation.length === 0,
      "manual progression has no base target or arithmetic explanation",
      JSON.stringify(manualSuggestions));
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
    colliding.exercises[4].libraryId = localId;
    await importFile(page, "split.json", JSON.stringify(colliding));
    // One decision at a time: each click re-renders the list, so a captured
    // NodeList goes stale after the first.
    for (let guard = 0; guard < 12; guard++) {
      const acted = await page.evaluate(() => {
        const row = [...document.querySelectorAll("#importRows .improw")].find((r) => r.classList.contains("is-open"));
        if (!row) return false;
        (row.querySelector('[data-imp-act="link"]') || row.querySelector('[data-imp-act="raw"]'))?.click();
        return true;
      });
      if (!acted) break;
      await settle(page, 150);
    }
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

    // ---- older and simpler shapes still import ----
    await reset(page);
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
      after.program.length === 1 && after.program[0].libraryId === "pr_bb",
      "the v2 program lands linked",
      JSON.stringify(after.program)
    );

    // ---- the app's own text export ----
    await reset(page);
    await openEditor(page);
    await importFile(page, "upper-lower.txt",
      "UPPER / LOWER, 2 days per week\n\nDAY 1: Chest · Back\n1. Barbell bench press [range@1]: 4× 4 to 8\n2. Barbell row: 3× 6 to 10\n\nDAY 2: Legs\n1. Leg press: 3× 8 to 12\n");
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
      after.program[0]?.progression?.strategy?.id === "range" &&
        after.program[0]?.progression?.strategy?.params?.repMax === 8,
      "text import carries the versioned progression envelope",
      JSON.stringify(after.program)
    );
    assert(
      after.programMeta.name === "Upper / Lower",
      "a text-export header restores the program title without its days-per-week suffix",
      after.programMeta.name
    );

    await reset(page);
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
          primary: "Mid/upper back", secondary: "Biceps" },
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
        primary: "Chest", secondary: "Triceps" }],
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
    const backup = JSON.stringify({
      settings: { unit: "kg", restSec: 180 },
      programMeta: {
        id: "backup-meta", name: "Restored split", started: "2026-06-15",
        progressionRelations: [{
          schemaVersion: 1, id: "relation-backup", type: "paired_exposure", version: 1,
          movementId: "movement:backup-pair",
          members: [{ exerciseId: "backup-volume", role: "volume" }, { exerciseId: "backup-heavy", role: "heavy" }],
        }],
        progressionModifiers: [
          { id: "modifier-backup", version: 1, compatibleStrategies: ["manual@1"], params: { pending: true } },
          { id: "modifier-future", version: 1, compatibleStrategies: ["manual@1"], params: { pending: true }, futureField: true },
        ],
      },
      program: [
        { id: "backup-heavy", movementId: "movement:backup-pair", day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8,
          progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 5, repMax: 8 } }, modifiers: [] } },
        { id: "backup-volume", movementId: "movement:backup-pair", day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12,
          progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] } },
      ],
      log: [
        { session: "2026-06-15_Day 1_a", date: "2026-06-15", day: "Day 1", name: "Barbell back squat", set: 1, load: 100, reps: 8, rir: 2 },
        { session: "2026-06-15_Day 1_a", date: "2026-06-15", day: "Day 1", name: "Barbell back squat", set: 2, load: 100, reps: 7, rir: 1 },
        { session: "2026-06-18_Day 1_b", date: "2026-06-18", day: "Day 1", name: "Barbell back squat", set: 1, load: 102.5, reps: 8, rir: 2 },
      ],
      programHistory: [],
    });
    const dialogState = () => page.evaluate(() => ({
      open: !document.querySelector("#importChoice").classList.contains("hidden"),
      body: document.querySelector("#importChoiceBody")?.textContent || "",
      programOnly: !document.querySelector("#importProgramOnly").classList.contains("hidden"),
      reviewing: document.body.classList.contains("is-import"),
    }));

    await reset(page);
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
    assert(restored.program?.length === 2, "restoring brings the program too", JSON.stringify(restored.program?.length));
    assert(restored.settings?.restSec === 180, "restoring brings the settings too", JSON.stringify(restored.settings));
    assert(
      restored.program.find((e) => e.id === "backup-heavy")?.progression?.strategy?.id === "range" &&
        restored.programMeta.progressionRelations?.[0]?.id === "relation-backup" &&
        restored.programMeta.progressionModifiers?.length === 0 &&
        restored.programMeta.progressionIncompatibilities?.some((item) => item.kind === "modifiers" &&
          item.value?.some?.((modifier) => modifier.id === "modifier-future")),
      "backup restore round-trips valid progression and preserves invalid collections with provenance",
      JSON.stringify({ program: restored.program, meta: restored.programMeta })
    );

    // Merge takes the sessions without touching anything else.
    await reset(page);
    await openEditor(page);
    await importFile(page, "backup.json", backup);
    await page.evaluate(() => document.querySelector("#importMerge").click());
    await settle(page, 900);
    restored = await getState(page);
    assert(new Set((restored.log || []).map((r) => r.session)).size === 2,
      "merging from this door brings the sessions", JSON.stringify(restored.log?.length));

    // Program only is still there for a lifter who wants the split alone.
    await reset(page);
    await openEditor(page);
    const cleanProgramOnly = JSON.parse(backup);
    cleanProgramOnly.programMeta.progressionModifiers = [];
    cleanProgramOnly.programMeta.progressionIncompatibilities = [];
    await importFile(page, "backup.json", JSON.stringify(cleanProgramOnly));
    await page.evaluate(() => document.querySelector("#importProgramOnly").click());
    await settle(page, 500);
    assert((await dialogState()).reviewing, "program only opens the review screen");
    await page.evaluate(() => {
      const draft = window.__repforgeImportDraft();
      draft.rows.forEach((r) => { r.reviewed = true; });
    });
    await reviewAndActivateImport(page);
    restored = await getState(page);
    assert(restored.program?.length === 2 && (restored.log || []).length === 0,
      "program only imports the exercises and leaves history alone",
      JSON.stringify({ program: restored.program?.length, log: restored.log?.length }));
    assert(
      restored.program[0]?.progression?.strategy?.id === "range" &&
        restored.programMeta.progressionRelations?.[0]?.id === "relation-backup",
      "program-only import keeps the versioned progression model",
      JSON.stringify({ program: restored.program, meta: restored.programMeta })
    );

    // ---- a backup with no sessions is still a backup ----
    // It was read as a plain program file, so a lifter restoring onto a fresh
    // install got their exercises and silently lost everything else the file
    // was carrying: the language, the rest timer, the RIR mode, and the
    // program's own name, dates and block. An empty log is not consent.
    const freshBackup = JSON.stringify({
      settings: { unit: "lb", restSec: 180, rirMode: "effort", lang: "pt", jumpPct: 5 },
      programMeta: {
        id: "fresh-meta", name: "Projeto novo", started: "2026-07-01",
        equipment: ["machines"], mesocycleLengthWeeks: 8, onboarded: true,
      },
      program: [
        { day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 },
        { day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12 },
      ],
      log: [],
      programHistory: [],
    });

    await reset(page);
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
    assert(restored.program?.length === 2, "restoring a session-less backup brings its program",
      JSON.stringify(restored.program?.length));

    // Program only is a partial import by choice — but the split's name is part
    // of the split, so it travels rather than being reinvented as "Untitled".
    await reset(page);
    await openEditor(page);
    await importFile(page, "empty-log.json", freshBackup);
    await page.evaluate(() => document.querySelector("#importProgramOnly").click());
    await settle(page, 500);
    await page.evaluate(() => {
      const draft = window.__repforgeImportDraft();
      draft.rows.forEach((r) => { r.reviewed = true; });
    });
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

    // A program-only file is still a program file: it has no log to speak for.
    await reset(page);
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
