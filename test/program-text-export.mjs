#!/usr/bin/env node
/**
 * Plain-text program export: the readable copy of the program a lifter can read
 * in the sheet, copy into a chat, or save as a .txt. Requires the app HTTP server.
 * Run: node test/program-text-export.mjs
 */
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

/** Two days, one of them with a fixed rep target, so both range shapes are covered. */
const TEMPLATES = [
  ["Dia 1", "Hack squat", 3, 4, 8, "Quads", "Glutes"],
  ["Dia 1", "Hip thrust com barra", 3, 6, 10, "Glutes", ""],
  ["Dia 1", "Cadeira flexora", 2, 6, 10, "Hamstrings", ""],
  ["Dia 2", "RDL", 3, 4, 8, "Hamstrings", "Glutes"],
  ["Dia 2", "Abdução em pé no cabo", 2, 12, 12, "Glutes", ""],
];

function fixture(lang) {
  const perDay = new Map();
  const program = TEMPLATES.map(([day, name, sets, min, max, primary, secondary], i) => {
    const order = (perDay.get(day) || 0) + 1;
    perDay.set(day, order);
    return {
      id: `ex${i}`, day, order, name, sets, min, max, primary, secondary, notes: "", alternates: [],
      ...(i < 2 ? { movementId: "movement:paired-test" } : {}),
      ...(i === 0 ? {
        progression: {
          schemaVersion: 1,
          strategy: { id: "range", version: 1, params: { workingSets: sets, repMin: min, repMax: max } },
          modifiers: [],
        },
      } : {}),
      ...(i === 1 ? {
        progressionIncompatibility: {
          version: 1, kind: "prescription", source: "test", reason: "future",
          value: { schemaVersion: 1, strategy: { id: "future_strategy", version: 99, params: { authored: true } }, modifiers: [] },
        },
      } : {}),
    };
  });
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
      unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "prog-text", name: "Treino Cecela", started: "2026-07-01",
      created: "2026-07-01T00:00:00.000Z", updated: "2026-07-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 2, splitType: "lower_upper",
      equipment: ["machines"], priorityMuscles: [], sessionLength: "60", completedAt: null,
      progressionRelations: [{
        schemaVersion: 1, id: "relation-text", type: "paired_exposure", version: 1,
        movementId: "movement:paired-test",
        members: [{ exerciseId: "ex0", role: "heavy" }, { exerciseId: "ex1", role: "volume" }],
      }],
      progressionModifiers: [{ id: "modifier-text", version: 1, compatibleStrategies: ["range@1"], params: { pending: true } }],
      progressionIncompatibilities: [{
        version: 1, kind: "modifiers", source: "test", reason: "future",
        value: [{ id: "future-modifier", version: 1, compatibleStrategies: ["range@1"], params: { pending: true }, futureField: true }],
      }],
    },
    program,
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
  const parsed = await page.evaluate((value) => window.__repforgeParseProgramSource(value, "progression.txt"), text);
  assert(parsed?.exercises?.[0]?.progression?.strategy?.id === "range", "text import recognizes the versioned progression marker");
  assert(parsed?.exercises?.[0]?.progression?.strategy?.params?.repMax === 8, "text import preserves range parameters");
  assert(parsed?.meta?.progressionRelations?.[0]?.id === "relation-text" &&
    parsed?.meta?.progressionModifiers?.[0]?.id === "modifier-text",
    "text import preserves structured relation and modifier data");
  assert(parsed?.exercises?.[1]?.progressionIncompatibility?.value?.strategy?.id === "future_strategy" &&
    parsed?.meta?.progressionIncompatibilities?.[0]?.value?.[0]?.id === "future-modifier",
    "text import preserves incompatible progression provenance");

  assert(lines[0] === "TREINO CECELA, 2 dias/semana", "header carries the program name and days per week", lines[0]);
  assert(lines[1] === "", "a blank line separates the header from the first day");
  assert(
    lines[2] === "DIA 1: Quadríceps · Glúteos · Posteriores",
    "day headers are uppercased and list their localized muscles",
    lines[2]
  );
  assert(lines[3] === "1. Hack squat: 3× 4 a 8", "exercise templates are numbered with sets × rep range", lines[3]);
  assert(lines.includes("TAURIFER-DATA"), "structured progression data is separated from user-facing copy");
  assert(
    lines.includes("2. Abdução em pé no cabo: 2× 12"),
    "a single-value rep target is not printed as a range",
    lines.filter((l) => l.includes("cabo")).join(" | ")
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
