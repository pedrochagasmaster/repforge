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

    // ---- staging writes nothing ----
    const before = await getState(page);
    await importFile(page, "split.json", v3);
    assert(
      await page.evaluate(() => document.querySelector("#importReview")?.classList.contains("active")),
      "reading a file opens the review screen"
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

    // ---- cancelling writes nothing ----
    await page.click("#importCancel");
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
      "UPPER / LOWER (2 days per week)\n\nDAY 1 — Chest · Back\n1. Barbell bench press — 4× 4-8\n2. Barbell row — 3× 6-10\n\nDAY 2 — Legs\n1. Leg press — 3× 8-12\n");
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

    // ---- prose is rejected, not guessed at ----
    const prose = await page.evaluate(() =>
      window.__repforgeParseProgramSource("Do some squats and then maybe a few curls, whatever feels good", "notes.txt"));
    assert(prose === null, "arbitrary prose is refused rather than invented into a program", JSON.stringify(prose));
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
