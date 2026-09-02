#!/usr/bin/env node
/** Focused Hold · recover gate checks. Requires http://localhost:8000/ */
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
    console.log(`    ${detail}`);
  }
}

async function clearState(page) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT });
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 10000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(() => typeof window.__repforgeRecoverSignal === "function", { timeout: 10000 });
}

async function persistState(page, state) {
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
}

/**
 * The two-day program these cases log against. A device that has not been
 * through onboarding holds no program, so the gate needs one seeded rather than
 * read off a bundled default.
 */
function gateProgram() {
  return [
    { id: "gate-ex-1", day: "Day 1", order: 1, name: "Hack squat", sets: 2, min: 4, max: 8,
      primary: "Quads", secondary: "Glutes" },
    { id: "gate-ex-2", day: "Day 1", order: 2, name: "Seated leg curl", sets: 2, min: 4, max: 8,
      primary: "Hamstrings", secondary: "" },
    { id: "gate-ex-3", day: "Day 2", order: 1, name: "Chest press", sets: 2, min: 4, max: 8,
      primary: "Chest", secondary: "Front delts,Triceps" },
  ];
}
function gateProgramMeta() {
  return {
    id: "gate-program", name: "Gate program", started: null,
    created: "2025-01-01T00:00:00.000Z", updated: "2025-01-01T00:00:00.000Z",
    goal: null, experience: null, daysPerWeek: 2, splitType: null, equipment: [],
    priorityMuscles: [], sessionLength: null, mesocycleLengthWeeks: 6,
    mesocycleStatus: "active", completedAt: null, onboarded: true,
    progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
    programStructure: null, entrySource: null,
  };
}

function setRows(ex, day, date, load, setSpecs) {
  const session = `${date}_${day}_recover_${ex.id}_${date}_${load}`;
  const created = new Date(`${date}T12:00:00Z`).toISOString();
  const specs = [];
  for (let i = 0; i < ex.sets; i++) specs.push(setSpecs[Math.min(i, setSpecs.length - 1)]);
  return specs.map((s, i) => ({
    session, date, day, name: ex.name, exerciseId: ex.id, set: i + 1,
    load, reps: s.reps, rir: s.rir, notes: "", created,
    primary: ex.primary, secondary: ex.secondary,
  }));
}

const browser = await launchChromium();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await waitForApp(page);

const cases = [
  {
    name: "Grind + rep gain → Hold · add reps",
    build: (ex, day, mid) => [
      ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 1 }, { reps: mid, rir: 1 }]),
      ...setRows(ex, day, "2025-03-08", 60, [{ reps: mid + 1, rir: 0 }, { reps: mid, rir: 0 }]),
    ],
    expectLabel: "Hold · add reps",
    expectRecover: false,
  },
  {
    name: "Grind + flat reps → Hold · recover",
    build: (ex, day, mid) => [
      ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
      ...setRows(ex, day, "2025-03-08", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
    ],
    expectLabel: "Hold · recover",
    expectRecover: true,
  },
  {
    name: "Grind + load jump → Hold · add reps",
    build: (ex, day, mid) => {
      const low = Math.max(ex.min, mid - 1);
      return [
        ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
        ...setRows(ex, day, "2025-03-08", 62.5, [{ reps: low, rir: 0 }, { reps: low, rir: 0 }]),
      ];
    },
    expectLabel: "Hold · add reps",
    expectRecover: false,
  },
  {
    name: "Single grinding session → Hold · add reps",
    build: (ex, day, mid) => setRows(ex, day, "2025-03-08", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
    expectLabel: "Hold · add reps",
    expectRecover: false,
  },
  {
    name: "Topped range at RIR 0 → Add load",
    build: (ex, day) => setRows(ex, day, "2025-03-08", 60, [{ reps: ex.max, rir: 0 }, { reps: ex.max, rir: 0 }]),
    expectLabel: "Add load",
    expectRecover: false,
  },
];

console.log("\nHold · recover performance gate");
for (const c of cases) {
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const meta = gateProgram()[0];
  const mid = Math.max(meta.min, Math.min(meta.max - 1, meta.min + 1));
  const rows = c.build(meta, meta.day, mid);

  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  await persistState(page, {
    ...state, program: gateProgram(), programMeta: gateProgramMeta(), log: rows,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const signal = await page.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const ex = (raw.program || []).find((e) => e.id === id);
    const rec = window.__repforgeRecommendation?.(ex);
    return {
      recover: window.__repforgeRecoverSignal?.(ex),
      label: rec?.label,
      status: rec?.status,
      text: rec?.text,
    };
  }, meta.id);

  assert(
    signal.label === c.expectLabel && signal.recover === c.expectRecover,
    c.name,
    JSON.stringify(signal)
  );
}

// Attention: productive grind should not be fatigue
await clearState(page);
await page.reload({ waitUntil: "domcontentloaded" });
await waitForApp(page);
{
  const meta = gateProgram()[0];
  const mid = Math.max(meta.min, Math.min(meta.max - 1, meta.min + 1));
  const rows = [
    ...setRows(meta, meta.day, "2025-03-01", 60, [{ reps: mid, rir: 1 }, { reps: mid, rir: 1 }]),
    ...setRows(meta, meta.day, "2025-03-08", 60, [{ reps: mid + 1, rir: 0 }, { reps: mid, rir: 0 }]),
  ];
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  await persistState(page, {
    ...state, program: gateProgram(), programMeta: gateProgramMeta(), log: rows,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const attn = await page.evaluate((name) => {
    const groups = window.__repforgeAttention?.() || [];
    const fatigue = groups.find((g) => g.key === "fatigue");
    return {
      fatigueNames: (fatigue?.items || []).map((i) => i.ex.name),
      why: fatigue?.items?.[0]?.why || null,
    };
  }, meta.name);
  assert(
    !attn.fatigueNames.includes(meta.name),
    "Attention: productive grind is not Possible fatigue",
    JSON.stringify(attn)
  );
}

await browser.close();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
