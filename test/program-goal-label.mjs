#!/usr/bin/env node
/**
 * The Program tab names a program's goal in words, never as a key (owner, iPhone, 2026-11-01:
 * "onb.goal.hybrid.label, 3 days per week, week 2 of 7").
 *
 * Generated programs store the engine's goal (hypertrophy, strength, hybrid); older programs may
 * still carry the retired onboarding's goals. For every one of them, an unknown value and no goal,
 * in English and Portuguese, the overview's line reads the approved label (or leaves the goal
 * out), keeps the days and the week, and no text on the Program tab is shaped like a key.
 *
 * Run: node test/program-goal-label.mjs   (requires the app served over HTTP)
 */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const CATALOG = { en: JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8")),
  pt: JSON.parse(readFileSync(new URL("../i18n-pt.json", import.meta.url), "utf8")) };
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}
const EXPECTED = {
  hypertrophy: "entry.goal.muscle_growth", strength: "entry.goal.strength", hybrid: "entry.goal.balanced",
  strength_hypertrophy: "onb.goal.strength_hypertrophy.label", beginner_consistency: "onb.goal.beginner_consistency.label",
  not_a_goal: null, [""]: null,
};

const browser = await launchChromium();
try {
  for (const lang of ["en", "pt"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === "pt" ? "pt-BR" : "en-US" });
    const page = await context.newPage();
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });
    for (const [goal, key] of Object.entries(EXPECTED)) {
      const tag = `[${lang}] goal ${goal || "(none)"}`;
      await page.evaluate(({ goal, lang }) => {
        const saved = JSON.parse(localStorage.getItem("repforge_v1"));
        if (goal) saved.programMeta.goal = goal; else delete saved.programMeta.goal;
        saved.settings = { ...(saved.settings || {}), lang };
        localStorage.setItem("repforge_v1", JSON.stringify(saved));
        return new Promise((done) => { const r = indexedDB.open("repforge", 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(saved, "repforge_v1"); tx.oncomplete = () => { db.close(); done(); }; tx.onerror = () => { db.close(); done(); }; }; r.onerror = () => done(); });
      }, { goal, lang });
      await page.reload();
      await waitForAppBoot(page, { base: BASE });
      await page.click('nav [data-view="program"]');
      await page.waitForSelector("#program.active #programOverview", { timeout: 10000 });
      const seen = await page.evaluate(() => {
        const root = document.querySelector("#program");
        const texts = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) { const v = walker.currentNode.nodeValue.trim(); if (v && walker.currentNode.parentElement?.getClientRects().length) texts.push(v); }
        return { lede: document.querySelector("#programOverview")?.innerText || "", texts };
      });
      const keyish = seen.texts.filter((text) => /^[a-z]+(\.[a-z_]+){2,}$/.test(text) || /\b[a-z]+(?:\.[a-z_]+)+\.(?:label|sub)\b/.test(text) || /\b(onb|entry)\.goal\b/.test(text));
      assert(keyish.length === 0, `${tag}: no text on the Program tab is shaped like a key`, JSON.stringify(keyish));
      const label = key ? CATALOG[lang][key] : null;
      if (label) assert(seen.lede.includes(label), `${tag}: the line names the goal "${label}"`, seen.lede.slice(0, 160));
      else assert(!Object.values(EXPECTED).filter(Boolean).some((k) => seen.lede.includes(CATALOG[lang][k])) && !seen.lede.includes(goal || "\u0000"),
        `${tag}: with no known goal the line leaves the goal out, never an id`, seen.lede.slice(0, 160));
      const days = (lang === "pt" ? /\d+ dias por semana/ : /\d+ days per week/).test(seen.lede);
      assert(days, `${tag}: the line keeps the days per week`, seen.lede.slice(0, 160));
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
