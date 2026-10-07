#!/usr/bin/env node
/**
 * Plain-text program export: the readable copy of the program a lifter can read
 * in the sheet, copy into a chat, or save as a .txt. Requires the app HTTP server.
 * Run: node test/program-text-export.mjs
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

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

/**
 * Two days, one of them with a fixed rep target, so both range shapes are
 * covered. Each row is a seed-program slot under a Portuguese program alias,
 * re-dosed in the canonical ProgramDefinition the export reads.
 * [day, seed slot, alias, sets, min, max]
 */
const TEMPLATES = [
  ["Dia 1", "seed-ex-1", "Hack squat", 3, 4, 8],
  ["Dia 1", "seed-ex-7", "Leg press 45", 3, 6, 10],
  ["Dia 1", "seed-ex-2", "Cadeira flexora", 2, 6, 10],
  ["Dia 2", "seed-ex-8", "RDL", 3, 4, 8],
  ["Dia 2", "seed-ex-6", "Cadeira adutora", 2, 12, 12],
];
const DAYS = [...new Set(TEMPLATES.map(([day]) => day))];
/* "Hack squat" is the movement's own catalog name rather than an alias, so a
   Portuguese export shows the catalog's Portuguese name for it. */
const PT_NAMES = { "Hack squat": "Agachamento hack" };

function fixture(lang) {
  const meta = seedProgramMeta();
  const definition = meta.programDefinition;
  const slots = new Map(definition.days.flatMap((day) => day.slots).map((slot) => [slot.id, slot]));
  const rows = new Map(seedProgram().map((row) => [row.id, row]));
  const program = [];
  definition.days.forEach((day, index) => {
    const label = DAYS[index];
    const entries = TEMPLATES.filter(([dayName]) => dayName === label);
    day.kind = entries.length ? "training" : "rest";
    if (label) day.name = label;
    day.slots = entries.map(([, id, alias, sets, min, max], slotIndex) => {
      const slot = structuredClone(slots.get(id));
      slot.order = slotIndex + 1;
      slot.displayName = alias;
      for (const cycle of slot.prescriptionsByCycle) {
        const template = cycle.sets[0];
        cycle.sets = Array.from({ length: sets }, (_, setIndex) => ({
          ...structuredClone(template),
          id: `${template.id}-${setIndex + 1}`,
          setIndex: setIndex + 1,
          targets: { reps: { min, max } },
        }));
      }
      program.push({ ...rows.get(id), day: label, dayId: day.id, order: slotIndex + 1, name: alias,
        displayName: alias, sets, min, max, alternates: [] });
      return slot;
    });
  });
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
      unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: { ...meta, id: "prog-text", name: "Treino Cecela", daysPerWeek: DAYS.length, programDefinition: definition },
    program,
    customExercises: [],
    log: [],
    programHistory: [],
  };
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
}

async function seed(page, state) {
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
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob: state }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

/** openModal marks body-level children inert, so probe the branch holding the view. */
function programBranchInert() {
  const view = document.querySelector("#program");
  const root = [...document.body.children].find((c) => c.contains(view));
  return root?.inert === true;
}

async function openSheet(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#exportProgramText", { timeout: 10000 });
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  return (await page.textContent("#programTextOut")) || "";
}

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  console.log("\nplain-text program export (pt)");
  await seed(page, fixture("pt"));
  const text = await openSheet(page);
  const lines = text.split("\n");
  const parsed = await page.evaluate((value) => window.__repforgeParseProgramSource(value, "program.txt"), text);
  const readBack = (parsed?.exercises || []).map(({ day, name, sets, min, max }) => [day, name, sets, min, max]);
  const authored = TEMPLATES.map(([day, , alias, sets, min, max]) => [day, PT_NAMES[alias] || alias, sets, min, max]);
  assert(JSON.stringify(readBack) === JSON.stringify(authored),
    "text import reads back every exercise with its day, sets and rep range", JSON.stringify(readBack));
  assert(parsed?.meta?.name === "Treino Cecela", "text import reads back the program name", parsed?.meta?.name);

  assert(lines[0] === "TREINO CECELA, 2 dias/semana", "header carries the program name and days per week", lines[0]);
  assert(lines[1] === "", "a blank line separates the header from the first day");
  assert(
    lines[2] === "DIA 1: Quadríceps · Glúteos · Posteriores",
    "day headers are uppercased and list their localized muscles",
    lines[2]
  );
  assert(lines[3] === "1. Agachamento hack: 3× 4 a 8", "exercise templates are numbered with sets × rep range", lines[3]);
  assert(!lines.includes("TAURIFER-DATA"), "the export is the readable copy alone, with no machine appendix");
  assert(
    lines.includes("2. Cadeira adutora: 2× 12"),
    "a single-value rep target is not printed as a range",
    lines.filter((l) => l.includes("adutora")).join(" | ")
  );
  assert(lines.filter((l) => /^DIA /.test(l)).length === 2, "every training day gets a header");
  assert(!/undefined|NaN|\[object/.test(text), "the export has no placeholder leakage");
  assert(!/[—“”‘’]/u.test(text), "the export uses plain punctuation");

  const focused = await page.evaluate(() => document.activeElement?.id);
  assert(focused === "programTextCopy", "opening the sheet moves focus into it", focused);
  const trapped = await page.evaluate(programBranchInert);
  assert(trapped, "the page behind the sheet is inert while it is open");

  await page.click("#programTextCopy");
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  assert(clip === text, "Copy puts the exact export on the clipboard");

  const download = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.click("#programTextShare"),
  ]).then(([d]) => d);
  const filename = download.suggestedFilename();
  assert(/^taurifer_program_treino-cecela_\d{4}-\d{2}-\d{2}\.txt$/.test(filename), "the saved file is a named .txt", filename);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => ({
    hidden: document.querySelector("#programTextSheet")?.hidden === true,
    focus: document.activeElement?.id,
    locked: document.body.classList.contains("is-sheet-open"),
  }));
  closed.inert = await page.evaluate(programBranchInert);
  assert(closed.hidden && !closed.locked && !closed.inert, "Escape closes the sheet and releases the page", JSON.stringify(closed));
  assert(closed.focus === "exportProgramText", "focus returns to the button that opened the sheet", closed.focus);

  console.log("\nplain-text program export (en)");
  await seed(page, fixture("en"));
  const en = (await openSheet(page)).split("\n");
  assert(en[0] === "TREINO CECELA, 2 days/week", "the header is localized", en[0]);
  assert(en[2] === "DIA 1: Quads · Glutes · Hamstrings", "muscles follow the UI language", en[2]);
  assert(en[3] === "1. Hack squat: 3× 4 to 8", "the rep range follows the UI language", en[3]);

  assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nprogram text export: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
