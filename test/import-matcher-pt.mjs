#!/usr/bin/env node
/**
 * The import matcher on the owner's Brazilian coach sample (import quality round, 2026-11-10).
 *
 * Every line of the sample, as the converter hands it to the review screen, must offer the movement a Brazilian gym
 * means by it as its top match:
 *   - common gym names (stiff, búlgaro, remada unilateral, rosca martelo, puxada alta…) reach the standard variant
 *     through reviewed Portuguese aliases;
 *   - a library name that is only equipment ("Pés na barra" is "barra") is never found inside a line, so "barra" no
 *     longer pulls in Toes-to-bar, and "puxada alta" no longer means a high pull;
 *   - when a line does not say which variant, the common one (the catalog's search boost) outranks rare ones
 *     (super ROM, cheat, cable rope).
 *
 * Run: node test/import-matcher-pt.mjs   (REPFORGE_URL points at a static server)
 */
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const { EXERCISE_LIBRARY } = require("../exercises.js");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const idOf = (name) => {
  const entry = EXERCISE_LIBRARY.find((item) => item.name === name);
  if (!entry) throw new Error(`fixture names a movement the catalog does not have: ${name}`);
  return entry.id;
};

// The owner's sample, one row per exercise line, with the movement each line means.
const SAMPLE = [
  ["Supino reto c/ barra", "Barbell bench press"],
  ["Supino inclinado com halteres", "45° incline dumbbell press"],
  ["Desenvolvimento militar", "Barbell overhead press"],
  ["Elevação lateral", "Standing dumbbell lateral raise"],
  ["Tríceps corda", "Cable rope triceps pushdown"],
  ["Mergulho no banco", "Bench dip"],
  ["Barra fixa", "Overhand grip pull-up"],
  ["Remada curvada", "Bent-over barbell row"],
  ["Puxada alta pegada aberta", "Wide grip cable lat pulldown"],
  ["Remada unilateral com halter", "Single arm dumbbell row (elbow-in)"],
  ["Rosca direta barra W", "EZ bar biceps curl"],
  ["Rosca martelo", "Standing dumbbell hammer curl"],
  ["Agachamento livre", "Barbell back squat"],
  ["Leg press 45°", "45° leg press"],
  ["Cadeira extensora", "Leg extension"],
  ["Stiff com barra", "Barbell Romanian deadlift"],
  ["Panturrilha em pé", "Standing machine calf raise"],
  ["Levantamento terra", "Conventional deadlift"],
  ["Afundo búlgaro", "Dumbbell Bulgarian split squat"],
  ["Supino fechado", "Close grip bench press"],
  ["Face pull", "Cable face pull"],
  // Timed holds and carries are left out of the import by the prompt (Front B); their match is still the plain one.
  ["Abdominal prancha", "Forearm plank"],
  ["Farmer walk", "Dumbbell farmer’s carry"],
];
// The same rules where a line adds words no alias covers, so the ranking, not an alias, decides.
const VARIANTS = [
  ["Elevação lateral halteres", "Standing dumbbell lateral raise"],
  ["Rosca martelo alternada", "Standing dumbbell hammer curl"],
  ["Remada unilateral serrote", "Single arm dumbbell row (elbow-in)"],
  ["Puxada alta aberta", "Wide grip cable lat pulldown"],
  ["Puxada alta na polia", "Overhand grip cable lat pulldown"],
  ["Rosca direta barra reta", "Barbell biceps curl"],
  ["Tríceps testa barra W", "EZ bar skull crusher"],
];
// What the owner saw offered for these lines and must never be offered again.
const TRAPS = [
  ["Stiff com barra", ["Toes-to-bar"]],
  ["Rosca direta barra W", ["Toes-to-bar"]],
  ["Puxada alta pegada aberta", ["Clean grip high pull", "Snatch grip high pull"]],
  ["Puxada alta aberta", ["Clean grip high pull", "Snatch grip high pull"]],
  ["Remada unilateral com halter", ["Single arm dumbbell bench press"]],
];

const results = { passed: 0, failed: 0 };
function check(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${JSON.stringify(detail)}`); }
}

const browser = await launchChromium();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);
  const match = (name) => page.evaluate((n) => window.__repforgeMatchCandidates(n), name);
  const nameOf = (id) => EXERCISE_LIBRARY.find((item) => item.id === id)?.name ?? id;

  console.log("\nThe owner's sample: every line's top match");
  for (const [line, expected] of SAMPLE) {
    const result = await match(line);
    check(result.matchId === idOf(expected), `${line} → ${expected}`, { got: nameOf(result.matchId), status: result.status });
  }
  console.log("\nLines with words no alias covers: the ranking decides");
  for (const [line, expected] of VARIANTS) {
    const result = await match(line);
    check(result.matchId === idOf(expected), `${line} → ${expected}`,
      { got: nameOf(result.matchId), offered: result.candidateIds.map(nameOf) });
  }
  console.log("\nToken traps are gone");
  for (const [line, never] of TRAPS) {
    const result = await match(line);
    const offered = [result.matchId, ...result.candidateIds].filter(Boolean).map(nameOf);
    check(never.every((name) => !offered.includes(name)), `${line} never offers ${never.join(" or ")}`, offered);
  }
} finally {
  await browser.close();
}
console.log(`\nImport matcher (PT): ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
