#!/usr/bin/env node
/** Proves history reconciliation calls the shipped Plan 061 matcher. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const APP_URL = process.env.REPFORGE_URL;
if (!APP_URL) { console.error("Set REPFORGE_URL"); process.exit(1); }

const fixture = name => readFileSync(new URL(`./fixtures/history-import/${name}`, import.meta.url), "utf8");
const modulePath = fileURLToPath(new URL("../history-import.js", import.meta.url));
let passed = 0;
function check(condition, message, detail = "") {
  assert.ok(condition, `${message}${detail ? `: ${detail}` : ""}`);
  passed++;
}

const browser = await launchChromium();
try {
  const page = await browser.newPage();
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);
  await page.addScriptTag({ path: modulePath });

  const hevy = fixture("hevy.csv");
  const unresolved = await page.evaluate(async text => {
    const module = window.RepForgeHistoryImport;
    return module.prepareHistoryImport(text, {
      classifyExercise: name => window.__repforgeMatchCandidates(name),
      getExercise: id => window.RepForgeExercises.library.find(entry => entry.id === id) || null,
    });
  }, hevy);
  const machine = unresolved.sessions.flatMap(session => session.rows)
    .find(row => row.name.includes("Hammer Strength"));
  check(unresolved.status === "needs-review" && unresolved.proposal === null,
    "probable or unmatched migration names stop before proposal creation");
  check(machine?.identity.status === "probable" || machine?.identity.status === "unmatched",
    "machine-specific wording is not promoted by the live matcher", machine?.identity.status || "missing row");
  if (machine?.identity.status === "probable") {
    check(machine.identity.candidates.length <= 3, "machine candidates preserve the Plan 061 shortlist bound");
  }

  const hevyAccepted = await page.evaluate(async ({ text, sourceMovementId }) => {
    const module = window.RepForgeHistoryImport;
    return module.prepareHistoryImport(text, {
      classifyExercise: name => window.__repforgeMatchCandidates(name),
      getExercise: id => window.RepForgeExercises.library.find(entry => entry.id === id) || null,
      decisions: { [sourceMovementId]: { kind: "keep-source" } },
    });
  }, { text: hevy, sourceMovementId: machine.sourceMovementId });
  const hevyBench = hevyAccepted.proposal?.rows.find(row => row.name === "Bench Press (Barbell)");
  check(hevyAccepted.status === "ready" && hevyBench?.performedLibraryId === "pr_bb",
    "the fixture-backed Hevy alias reaches the curated barbell bench identity");
  check(hevyBench?.historyImport.identity === "alias" && hevyBench.performedName === "Bench Press (Barbell)",
    "the alias is provenance while the imported label remains truthful");
  const unresolvedAttribution = await page.evaluate(text => {
    const row = JSON.parse(text);
    return window.__repforgeRowMuscles(row);
  }, JSON.stringify(hevyAccepted.proposal?.rows.find(row => row.name.includes("Hammer Strength"))));
  check(unresolvedAttribution?.primary === "" && unresolvedAttribution?.secondary === "",
    "unresolved identity cannot inherit muscle attribution from a same-named program exercise");

  const generic = "date,session_id,title,exercise_name,weight_kg,reps\n2024-05-06,pt-1,Pull,Cadeira flexora,30,12";
  const genericResult = await page.evaluate(async text => {
    const module = window.RepForgeHistoryImport;
    return module.prepareHistoryImport(text, {
      source: "generic",
      classifyExercise: name => window.__repforgeMatchCandidates(name),
      getExercise: id => window.RepForgeExercises.library.find(entry => entry.id === id) || null,
    });
  }, generic);
  check(genericResult.status === "ready" && genericResult.proposal.rows[0].performedLibraryId === "lc_mc",
    "Portuguese generic CSV identity is resolved by the real matcher");
  check(genericResult.proposal.rows[0].historyImport.identity === "alias",
    "Plan 061 alias status survives source reconciliation");

  const strong = "Date,Workout #,Workout Name,Exercise Name,Set Order,Weight (kg),Reps\n2024-06-04,st-1,Push,Barbell bench press,1,80,8";
  const strongResult = await page.evaluate(async text => {
    const module = window.RepForgeHistoryImport;
    return module.prepareHistoryImport(text, {
      classifyExercise: name => window.__repforgeMatchCandidates(name),
      getExercise: id => window.RepForgeExercises.library.find(entry => entry.id === id) || null,
    });
  }, strong);
  check(strongResult.status === "ready" && strongResult.proposal.rows[0].historyImport.identity === "exact",
    "Strong exact matches preserve the matcher's exact status");
} finally {
  await browser.close();
}

console.log(`history import matcher integration: ${passed} checks passed`);
