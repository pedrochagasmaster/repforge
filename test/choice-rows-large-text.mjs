#!/usr/bin/env node
/**
 * Choice rows hold at 200% text (owner, 2026-10-25). A choice list is plain rows with a trailing mark (native UI kit
 * §5, PR B): no box around a row and no selected ring, at any text size. The tile families (numbers, muscles, compact
 * pickers, reason pills) are tiles by design and are left out.
 *
 * Every catalog state that draws a choice list is opened at 200% text in EN and PT, and every row is read: no side
 * borders, no corner radius, no fill and no inset ring, chosen or not; and every choice (a radio or checkbox row, not
 * the import doors that share the row and navigate) carries its trailing mark.
 *
 * Run: node test/choice-rows-large-text.mjs (requires a static server on REPFORGE_URL).
 */
import { launchChromium } from "./browser.mjs";
import { openCatalogState } from "./fixtures/catalog-state.mjs";

const STATES = [
  "progress/schedule-diagnosis", "onboarding-start/hub-chosen", "onboarding-import/source", "onboarding-recommend/background",
  "onboarding-recommend/environment", "onboarding-recommend/equipment", "onboarding-recommend/result-block-sheet",
  "onboarding-recommend/review-sheet-execution-mode", "program/editor-suggest-loads",
];
const TILES = ".onb__num, .onb__grid, .entry-b__compact, .onb__opts--reasons";

let passed = 0;
const failures = [];
const check = (ok, message, detail) => {
  if (ok) { passed++; console.log(`  ✓ ${message}`); }
  else { failures.push(message); console.log(`  ✗ ${message}\n    ${JSON.stringify(detail)}`); }
};

const browser = await launchChromium();
try {
  for (const lang of ["en", "pt"]) for (const key of STATES) {
    const { context, page } = await openCatalogState(browser, key, 390, lang, "text200");
    try {
      const rows = await page.evaluate((tiles) => [...document.querySelectorAll(".radio-card")]
        .filter((row) => row.getClientRects().length && !row.closest(tiles) && !row.closest("[inert],[aria-hidden='true']"))
        .map((row) => {
          const s = getComputedStyle(row), mark = row.querySelector(".radio-card__mark");
          return {
            text: row.textContent.trim().slice(0, 32),
            selected: row.matches(".is-selected,[aria-checked='true']"),
            // A choice is a radio or checkbox row (or one drawn with a mark); the import doors share the row but navigate.
            choice: row.matches("[role='radio'],[role='checkbox']") || !!row.querySelector(".radio-card__mark"),
            sides: parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth),
            radius: parseFloat(s.borderTopLeftRadius) + parseFloat(s.borderBottomRightRadius),
            fill: s.backgroundColor, ring: s.boxShadow,
            mark: mark ? getComputedStyle(mark).boxShadow !== "none" || getComputedStyle(mark).backgroundColor !== "rgba(0, 0, 0, 0)" : false,
          };
        }), TILES);
      const label = `${key} [${lang}] 200%`;
      check(rows.length > 0, `${label}: the choice rows are on screen`, rows);
      const boxed = rows.filter((row) => row.sides > 0 || row.radius > 0 || row.fill !== "rgba(0, 0, 0, 0)" || row.ring !== "none");
      check(boxed.length === 0, `${label}: no choice row draws a box, a fill or a ring`, boxed);
      check(rows.filter((row) => row.choice).every((row) => row.mark), `${label}: every choice row carries its trailing mark`,
        rows.filter((row) => row.choice && !row.mark));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}
console.log(`\nChoice rows at 200% text: ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
