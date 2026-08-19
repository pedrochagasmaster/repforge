#!/usr/bin/env node
/**
 * Importing a program is a review, not a write.
 *
 * Reading a file used to link names and replace the program behind one
 * confirm(), so a wrong file had already landed by the time you saw it. Now the
 * file is parsed into a transient model, every name is classified, likely
 * matches have to be looked at, and durable state moves once — on Import.
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
}

async function openEditor(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await settle(page, 200);
  await page.evaluate(() => {
    if (document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"))
      document.querySelector("#programEditToggle")?.click();
    document.querySelector("#advanced")?.setAttribute("open", "");
  });
  await page.waitForSelector("#programEditor .pex", { timeout: 5000 });
}

async function importFile(page, name, body) {
  await page.setInputFiles("#importProgram", {
    name, mimeType: name.endsWith(".txt") ? "text/plain" : "application/json",
    buffer: Buffer.from(body),
  });
  await settle(page, 500);
}

const v3 = JSON.stringify({
  version: 3,
  meta: { name: "Imported split" },
  exercises: [
    { day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 },
    { day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12 },
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

    await page.click("#importCommit");
    await settle(page, 700);
    after = await getState(page);
    assert(after.program.length === 5, "committing writes the reviewed program", `${after.program.length} rows`);
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
    const colliding = JSON.parse(v3);
    // The file claims the id the local definition already holds, for a
    // different movement — two devices minting ids independently.
    colliding.customExercises[0].id = localId;
    colliding.exercises[4].libraryId = localId;
    await openEditor(page);
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
    await page.click("#importCommit");
    await settle(page, 700);
    after = await getState(page);
    const mine = (after.customExercises || []).find((e) => e.name === "Something else entirely");
    const theirs = (after.customExercises || []).find((e) => e.name === "My gym row");
    assert(
      mine && mine.id === localId && mine.primary === "Chest",
      "a colliding import does not overwrite the local definition",
      JSON.stringify(after.customExercises?.map((e) => [e.id, e.name]))
    );
    assert(
      theirs && theirs.id !== localId,
      "the imported definition is minted a fresh id instead",
      JSON.stringify([theirs?.id, theirs?.name])
    );
    assert(
      after.program.some((e) => e.libraryId === theirs?.id),
      "templates are repointed at the newly minted id",
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
    await page.click("#importCommit");
    await settle(page, 600);
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
      "UPPER / LOWER, 2 days per week\n\nDAY 1: Chest · Back\n1. Barbell bench press: 4× 4 to 8\n2. Barbell row: 3× 6 to 10\n\nDAY 2: Legs\n1. Leg press: 3× 8 to 12\n");
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
    await page.click("#importCommit");
    await settle(page, 600);
    after = await getState(page);
    assert(
      after.program.length === 3 && after.program.filter((e) => e.day === "Day 1").length === 2,
      "the text import lands with its days and rep ranges",
      JSON.stringify(after.program.map((e) => [e.day, e.name, e.sets, e.min, e.max]))
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
    const atomic = await page.evaluate(async (key) => {
      const writes = [];
      const io = {
        writeLocal(snapshot) {
          const copy = structuredClone(snapshot);
          writes.push(copy);
          localStorage.setItem(key, JSON.stringify(copy));
        },
        async writeIdb(snapshot) {
          const db = await new Promise((res, rej) => {
            const req = indexedDB.open("repforge", 1);
            req.onupgradeneeded = () => req.result.createObjectStore("kv");
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(structuredClone(snapshot), key);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        },
      };
      const result = await window.__repforgeCommitImport(io);
      const coherent = (snapshot) =>
        snapshot.customExercises?.some((e) => e.id === "custom:onboarding") &&
        snapshot.program?.some((e) => e.libraryId === "custom:onboarding") &&
        snapshot.programMeta?.name === "Atomic onboarding";
      return {
        result,
        count: writes.length,
        everyWriteCoherent: writes.length > 0 && writes.every(coherent),
        finalCoherent: coherent(JSON.parse(localStorage.getItem(key) || "{}")),
      };
    }, KEY);
    assert(
      atomic.result?.localOk && atomic.result?.idbOk && atomic.finalCoherent,
      "onboarding persists the imported custom definition and program together",
      JSON.stringify(atomic)
    );
    assert(
      atomic.count === 2 && atomic.everyWriteCoherent,
      "the two-phase durable write has no intermediate custom-only snapshot",
      JSON.stringify(atomic)
    );

    // ---- prose is rejected, not guessed at ----
    const prose = await page.evaluate(() =>
      window.__repforgeParseProgramSource("Do some squats and then maybe a few curls, whatever feels good", "notes.txt"));
    assert(prose === null, "arbitrary prose is refused rather than invented into a program", JSON.stringify(prose));

    // ---- a full backup is not a program file ----
    // The sessions in the file are the whole point of a backup. Reading only
    // its exercises threw them away silently, which is indistinguishable from
    // a restore that worked until you open History and it is empty.
    const backup = JSON.stringify({
      settings: { unit: "kg", restSec: 180 },
      programMeta: { id: "backup-meta", name: "Restored split", started: "2026-06-15" },
      program: [
        { day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 },
        { day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12 },
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
    await importFile(page, "backup.json", backup);
    await page.evaluate(() => document.querySelector("#importProgramOnly").click());
    await settle(page, 500);
    assert((await dialogState()).reviewing, "program only opens the review screen");
    await page.evaluate(() => {
      const draft = window.__repforgeImportDraft();
      draft.rows.forEach((r) => { r.reviewed = true; });
    });
    await page.evaluate(() => document.querySelector("#importCommit").click());
    await settle(page, 900);
    restored = await getState(page);
    assert(restored.program?.length === 2 && (restored.log || []).length === 0,
      "program only imports the exercises and leaves history alone",
      JSON.stringify({ program: restored.program?.length, log: restored.log?.length }));

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
    await page.evaluate(() => document.querySelector("#importCommit").click());
    await settle(page, 900);
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
