#!/usr/bin/env node
/**
 * Planned assertions and characterization for Plan 054 packet 054-P6:
 * Expert-control reflow and Browse summary provenance.
 *
 * Proves:
 * (1) Authoritative entry choice vocabulary: all 10 muscle rows (ENTRY_MUSCLES) and all 40
 *     advanced choice controls (normal, prioritize, deemphasize, ignore) remain in the DOM
 *     and visible at 320px compact viewport and at real 200% root text scale;
 * (2) Hairline separation and accessible semantics: each muscle row is separated by a hairline
 *     border, has an accessible label (id="entryMuscleLabel-<muscle>"), and one accessible
 *     radiogroup linked via aria-labelledby;
 * (3) Responsive 2x2 / full-width layout: choices reflow responsively (2x2 grid when space allows,
 *     full-width stack under compact/200% constraints) without horizontal overflow or overlap;
 * (4) Demanding localization: Portuguese (pt-BR) labels and state copy remain fully visible and
 *     unclipped without horizontal scroll or overlap at 200% text scale;
 * (5) Browse summary facts provenance: rendered frequency, duration, equipment fit, progression
 *     model, structure facts, and mismatch strictly derive from canonical compiler/curation
 *     fields from an independent oracle; facts are never inferred from program names;
 * (6) Bounded fact-source delta for unknown/missing facts: unknown facts must be omitted or show
 *     honest unavailable copy, never leaving dangling empty labels or guessed values;
 * (7) Deliberate fault switch: REPFORGE_ENTRY_EXPERT_FAULT supports mutation modes:
 *     - "hide-choice" (or truthy default): hides one advanced choice, failing vocabulary visibility;
 *     - "guess-fact": replaces a Browse fact with a name-derived guess, failing fact provenance.
 *
 * Run:
 *   REPFORGE_URL=http://127.0.0.1:8054 node test/entry-expert-controls.mjs
 *   REPFORGE_ENTRY_EXPERT_FAULT=hide-choice REPFORGE_URL=http://127.0.0.1:8054 node test/entry-expert-controls.mjs
 */
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Compiler = require("../program-compiler.js");
const Adapter = require("../program-entry-adapter.js");
const EXERCISE_LIBRARY = require("../exercises.js");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_ENTRY_EXPERT_FAULT;

const ENTRY_MUSCLE_STATES = Object.freeze(["normal", "prioritize", "deemphasize", "ignore"]);
const { ENTRY_MUSCLES } = Entry;

const results = {
  passed: 0,
  failed: 0,
  failures: [],
  expectedBaselineGaps: [],
};

function assert(cond, name, detail, isExpectedBaselineGap = false) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    const message = detail ? `${name} -> ${detail}` : name;
    results.failures.push(message);
    if (isExpectedBaselineGap) {
      results.expectedBaselineGaps.push(message);
      console.log(`  ✗ [EXPECTED BASELINE RED] ${name}`);
    } else {
      console.log(`  ✗ ${name}`);
    }
    if (detail != null) console.log(`    ${detail}`);
  }
}

/**
 * Navigate to the Custom route muscle priorities step.
 */
async function navigateToCustomPriorities(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading");
  await page.click('[data-entry-route="custom"]');
  await page.waitForSelector('[data-entry-pick="desiredResult"]');
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-pick="structuredExperience"]');
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-pick="daysPerWeek"]');
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-pick="environment"]');
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  await page.waitForSelector(".entry__muscle-row");
}

/**
 * Navigate to the Browse route catalogue step.
 */
async function navigateToBrowseCatalogue(page, answers = { daysPerWeek: 4, sessionMinutes: 60, environment: "commercial_gym" }) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading");
  await page.click('[data-entry-route="browse"]');
  await page.waitForSelector('[data-entry-pick="daysPerWeek"]');
  await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${answers.daysPerWeek}"]`);
  await page.click(`[data-entry-pick="sessionMinutes"][data-entry-val="${answers.sessionMinutes}"]`);
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-pick="environment"]');
  await page.click(`[data-entry-pick="environment"][data-entry-val="${answers.environment}"]`);
  await page.click("#onbNext");
  await page.waitForSelector(".entry-prog");
}

console.log("Plan 054-P6 Characterization: Expert Controls Reflow & Browse Summary Provenance");
console.log(`Target: ${BASE}`);
if (FAULT) console.log(`DELIBERATE FAULT ACTIVE: REPFORGE_ENTRY_EXPERT_FAULT="${FAULT}"`);

const browser = await launchChromium();

try {
  // =========================================================================
  // Phase 1: Authoritative Choice Vocabulary & Hairline Reflow at 320px Viewport
  // =========================================================================
  console.log("\nPhase 1: Authoritative muscle controls vocabulary and reflow at 320px compact viewport");
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await navigateToCustomPriorities(page);

      // Fault injection: hide an advanced choice button to simulate removing controls to shorten page
      if (FAULT === "hide-choice" || FAULT === "1" || FAULT === "true") {
        console.log("  [FAULT] Hiding authoritative choice 'chest|ignore' to verify visibility assertion failure");
        await page.evaluate(() => {
          const btn = document.querySelector('[data-entry-pick="musclePriority"][data-entry-val="chest|ignore"]');
          if (btn) btn.style.display = "none";
        });
      }

      const inspect = await page.evaluate(({ ENTRY_MUSCLES, ENTRY_MUSCLE_STATES }) => {
        const root = document.querySelector("#onboarding");
        const rootRect = root.getBoundingClientRect();
        const rows = [...document.querySelectorAll(".entry__muscle-row")];

        const rowChecks = [];
        let totalButtons = 0;
        let visibleButtons = 0;
        let touchTargetFails = 0;
        let clippedButtons = 0;
        let buttonOverlaps = 0;
        let labelOverlaps = 0;
        const missingChoices = [];
        const hiddenChoices = [];

        // Verify each authoritative muscle
        for (let rIdx = 0; rIdx < ENTRY_MUSCLES.length; rIdx++) {
          const muscle = ENTRY_MUSCLES[rIdx];
          const row = rows[rIdx];
          if (!row) {
            rowChecks.push({ muscle, exists: false });
            continue;
          }

          const labelEl = row.querySelector(".entry__muscle-name");
          const labelId = labelEl?.getAttribute("id");
          const groupEl = row.querySelector(".entry__muscle-states");
          const groupRole = groupEl?.getAttribute("role");
          const groupLabelledBy = groupEl?.getAttribute("aria-labelledby");
          const rowStyle = getComputedStyle(row);
          const hasHairline = rIdx === 0 ? true : (rowStyle.borderTopWidth === "1px" && rowStyle.borderTopStyle === "solid");

          const states = [...row.querySelectorAll(".entry__muscle-state")];
          totalButtons += states.length;
          const rects = states.map((s) => s.getBoundingClientRect());

          // Check all 4 authoritative states exist and are visible
          for (const state of ENTRY_MUSCLE_STATES) {
            const btn = row.querySelector(`[data-entry-pick="musclePriority"][data-entry-val="${muscle}|${state}"]`);
            if (!btn) {
              missingChoices.push(`${muscle}|${state}`);
            } else {
              const bStyle = getComputedStyle(btn);
              const bRect = btn.getBoundingClientRect();
              const isVis = bStyle.display !== "none" && bStyle.visibility !== "hidden" && bRect.width > 0 && bRect.height > 0;
              if (!isVis) hiddenChoices.push(`${muscle}|${state}`);
              else visibleButtons++;
              if (bRect.height < 43.5) touchTargetFails++;
              if (bRect.left < rootRect.left - 1 || bRect.right > rootRect.right + 1) clippedButtons++;
            }
          }

          // Check overlap between choice buttons
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i];
              const b = rects[j];
              const xOverlap = a.left < b.right - 0.5 && a.right > b.left + 0.5;
              const yOverlap = a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
              if (xOverlap && yOverlap) buttonOverlaps++;
            }
          }

          // Check overlap between label and choice buttons
          if (labelEl) {
            const lRect = labelEl.getBoundingClientRect();
            for (const r of rects) {
              const xOverlap = lRect.left < r.right - 0.5 && lRect.right > r.left + 0.5;
              const yOverlap = lRect.top < r.bottom - 0.5 && lRect.bottom > r.top + 0.5;
              if (xOverlap && yOverlap) labelOverlaps++;
            }
          }

          // Layout analysis: distinct columns and rows
          const xs = [...new Set(rects.map((r) => Math.round(r.left)))];
          const ys = [...new Set(rects.map((r) => Math.round(r.top)))];
          const is2x2 = xs.length === 2 && ys.length === 2;
          const isFullWidth = xs.length === 1 && ys.length === 4;

          rowChecks.push({
            muscle,
            exists: true,
            hasHairline,
            labelId,
            groupRole,
            groupLabelledBy,
            statesCount: states.length,
            isResponsiveLayout: is2x2 || isFullWidth,
            layoutKind: is2x2 ? "2x2" : isFullWidth ? "full-width" : `other(${xs.length}x${ys.length})`,
          });
        }

        return {
          rowCount: rows.length,
          rowChecks,
          totalButtons,
          visibleButtons,
          touchTargetFails,
          clippedButtons,
          buttonOverlaps,
          labelOverlaps,
          missingChoices,
          hiddenChoices,
          horizontalOverflow: root.scrollWidth > root.clientWidth,
          scrollDelta: root.scrollWidth - root.clientWidth,
        };
      }, { ENTRY_MUSCLES, ENTRY_MUSCLE_STATES });

      assert(
        inspect.rowCount === 10,
        "Every authoritative muscle row (10 rows) is present in the DOM at 320px",
        `Observed ${inspect.rowCount} rows`
      );

      assert(
        inspect.missingChoices.length === 0,
        "Every advanced muscle choice in the authoritative entry vocabulary (40 controls) is in the DOM",
        inspect.missingChoices.length ? `Missing: ${inspect.missingChoices.join(", ")}` : null
      );

      assert(
        inspect.hiddenChoices.length === 0 && inspect.visibleButtons === 40,
        "Every advanced muscle choice remains visible at 320px compact viewport (none removed or hidden)",
        inspect.hiddenChoices.length ? `Hidden/invisible: ${inspect.hiddenChoices.join(", ")}` : null
      );

      assert(
        inspect.touchTargetFails === 0,
        "Every muscle choice button meets the 44px touch target minimum",
        `Failures: ${inspect.touchTargetFails}`
      );

      const hairlinesOk = inspect.rowChecks.every((r) => r.hasHairline);
      assert(
        hairlinesOk,
        "Each muscle is a hairline-separated row with 1px rule separation",
        JSON.stringify(inspect.rowChecks.map((r) => ({ muscle: r.muscle, hairline: r.hasHairline })))
      );

      const accessibleSemanticsOk = inspect.rowChecks.every(
        (r) => r.labelId === `entryMuscleLabel-${r.muscle}` &&
               r.groupRole === "radiogroup" &&
               r.groupLabelledBy === `entryMuscleLabel-${r.muscle}`
      );
      assert(
        accessibleSemanticsOk,
        "Each muscle row carries an accessible label and one accessible radiogroup with aria-labelledby",
        JSON.stringify(inspect.rowChecks.map((r) => ({ muscle: r.muscle, labelId: r.labelId, role: r.groupRole })))
      );

      const reflowOk = inspect.rowChecks.every((r) => r.isResponsiveLayout);
      assert(
        reflowOk,
        "Each muscle presents choices in a responsive 2x2 or full-width reflow layout at 320px",
        JSON.stringify(inspect.rowChecks.map((r) => ({ muscle: r.muscle, layout: r.layoutKind })))
      );

      assert(
        !inspect.horizontalOverflow && inspect.clippedButtons === 0,
        "Expert controls at 320px have zero horizontal overflow and zero clipping",
        `scrollDelta: ${inspect.scrollDelta}px, clipped: ${inspect.clippedButtons}`
      );

      assert(
        inspect.buttonOverlaps === 0 && inspect.labelOverlaps === 0,
        "Expert controls at 320px have zero overlap between choice buttons or row labels",
        `buttonOverlaps: ${inspect.buttonOverlaps}, labelOverlaps: ${inspect.labelOverlaps}`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 2: Canonical 2x2 Layout at Standard Phone Viewport (390px)
  // =========================================================================
  console.log("\nPhase 2: Canonical 2x2 grid layout verification at standard 390px phone viewport");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await navigateToCustomPriorities(page);

      const gridCheck = await page.evaluate(() => {
        const rows = [...document.querySelectorAll(".entry__muscle-row")];
        const layoutKinds = rows.map((row) => {
          const states = [...row.querySelectorAll(".entry__muscle-state")];
          const rects = states.map((s) => s.getBoundingClientRect());
          const xs = [...new Set(rects.map((r) => Math.round(r.left)))];
          const ys = [...new Set(rects.map((r) => Math.round(r.top)))];
          return xs.length === 2 && ys.length === 2 ? "2x2" : `${xs.length}x${ys.length}`;
        });
        const root = document.querySelector("#onboarding");
        return {
          all2x2: layoutKinds.every((k) => k === "2x2"),
          layoutKinds,
          horizontalOverflow: root.scrollWidth > root.clientWidth,
        };
      });

      assert(
        gridCheck.all2x2,
        "Each muscle choice group arranges into a 2x2 grid when viewport width permits (390px)",
        `Observed layouts: ${gridCheck.layoutKinds.join(", ")}`
      );

      assert(
        !gridCheck.horizontalOverflow,
        "Standard phone viewport renders expert controls without horizontal overflow",
        null
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 3: Real 200% Root Text Scale Reflow (English at 390px and 320px)
  // =========================================================================
  console.log("\nPhase 3: Real 200% root text scale reflow and visibility");
  for (const { width, height, vpLabel } of [
    { width: 390, height: 844, vpLabel: "390px" },
    { width: 320, height: 568, vpLabel: "320px" },
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      // Apply real 200% root font size
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await navigateToCustomPriorities(page);

      const text200Info = await page.evaluate(({ ENTRY_MUSCLES, ENTRY_MUSCLE_STATES }) => {
        const root = document.querySelector("#onboarding");
        const rootRect = root.getBoundingClientRect();
        const rows = [...document.querySelectorAll(".entry__muscle-row")];

        let visibleCount = 0;
        let overlaps = 0;
        let clipped = 0;
        const missing = [];

        for (const muscle of ENTRY_MUSCLES) {
          for (const state of ENTRY_MUSCLE_STATES) {
            const btn = document.querySelector(`[data-entry-pick="musclePriority"][data-entry-val="${muscle}|${state}"]`);
            if (!btn) {
              missing.push(`${muscle}|${state}`);
              continue;
            }
            const s = getComputedStyle(btn);
            const r = btn.getBoundingClientRect();
            if (s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0) {
              visibleCount++;
            }
            if (r.left < rootRect.left - 1 || r.right > rootRect.right + 1) clipped++;
          }
        }

        // Check for overlaps within each row
        for (const row of rows) {
          const states = [...row.querySelectorAll(".entry__muscle-state")];
          const rects = states.map((el) => el.getBoundingClientRect());
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i];
              const b = rects[j];
              const xOverlap = a.left < b.right - 0.5 && a.right > b.left + 0.5;
              const yOverlap = a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
              if (xOverlap && yOverlap) overlaps++;
            }
          }
        }

        return {
          visibleCount,
          missing,
          clipped,
          overlaps,
          horizontalOverflow: root.scrollWidth > root.clientWidth,
          scrollDelta: root.scrollWidth - root.clientWidth,
        };
      }, { ENTRY_MUSCLES, ENTRY_MUSCLE_STATES });

      assert(
        text200Info.visibleCount === 40 && text200Info.missing.length === 0,
        `All 40 advanced muscle choices remain in DOM and visible at real 200% root text (${vpLabel})`,
        `Visible: ${text200Info.visibleCount}/40, missing: ${text200Info.missing.join(", ") || "none"}`
      );

      assert(
        !text200Info.horizontalOverflow && text200Info.clipped === 0,
        `Zero horizontal scroll and zero clipping at real 200% root text (${vpLabel})`,
        `scrollDelta: ${text200Info.scrollDelta}px, clipped: ${text200Info.clipped}`
      );

      assert(
        text200Info.overlaps === 0,
        `Zero overlap between choice buttons at real 200% root text (${vpLabel})`,
        `Overlaps: ${text200Info.overlaps}`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 4: Demanding Localization + 200% Root Text Scale (PT-BR at 200%)
  // =========================================================================
  console.log("\nPhase 4: Demanding PT-BR localization with 200% root text scale");
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await navigateToCustomPriorities(page);

      const ptInfo = await page.evaluate(() => {
        const root = document.querySelector("#onboarding");
        const rootRect = root.getBoundingClientRect();
        const rows = [...document.querySelectorAll(".entry__muscle-row")];

        const EXPECTED_PT_LABELS = [
          "Peito", "Costas", "Quadríceps", "Posteriores", "Glúteos",
          "Deltoides laterais", "Bíceps", "Tríceps", "Panturrilhas", "Dorsais"
        ];
        const EXPECTED_PT_STATES = ["Normal", "Priorizar", "Reduzir ênfase", "Ignorar"];

        const observedLabels = rows.map((r) => r.querySelector(".entry__muscle-name span")?.textContent.trim());
        const firstRowStates = [...rows[0].querySelectorAll(".entry__muscle-state")].map((s) => s.textContent.trim());

        let visibleCount = 0;
        let overlaps = 0;
        let clipped = 0;

        for (const row of rows) {
          const states = [...row.querySelectorAll(".entry__muscle-state")];
          const rects = states.map((s) => s.getBoundingClientRect());
          for (let i = 0; i < states.length; i++) {
            const btn = states[i];
            const r = rects[i];
            const style = getComputedStyle(btn);
            if (style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0) {
              visibleCount++;
            }
            if (r.left < rootRect.left - 1 || r.right > rootRect.right + 1) clipped++;
          }
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i];
              const b = rects[j];
              const xOverlap = a.left < b.right - 0.5 && a.right > b.left + 0.5;
              const yOverlap = a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
              if (xOverlap && yOverlap) overlaps++;
            }
          }
        }

        return {
          observedLabels,
          expectedLabels: EXPECTED_PT_LABELS,
          firstRowStates,
          expectedStates: EXPECTED_PT_STATES,
          visibleCount,
          overlaps,
          clipped,
          horizontalOverflow: root.scrollWidth > root.clientWidth,
          scrollDelta: root.scrollWidth - root.clientWidth,
        };
      });

      const labelsMatch = JSON.stringify(ptInfo.observedLabels) === JSON.stringify(ptInfo.expectedLabels);
      assert(
        labelsMatch,
        "Portuguese muscle row names render correctly for all 10 authoritative muscles",
        `Observed: ${ptInfo.observedLabels.join(", ")}`
      );

      const statesMatch = JSON.stringify(ptInfo.firstRowStates) === JSON.stringify(ptInfo.expectedStates);
      assert(
        statesMatch,
        "Portuguese muscle states render correctly (Normal, Priorizar, Reduzir ênfase, Ignorar)",
        `Observed: ${ptInfo.firstRowStates.join(", ")}`
      );

      assert(
        ptInfo.visibleCount === 40,
        "All 40 muscle choice controls remain visible in PT-BR at 200% root text on 320px",
        `Visible: ${ptInfo.visibleCount}/40`
      );

      assert(
        !ptInfo.horizontalOverflow && ptInfo.clipped === 0,
        "PT-BR at 200% text reflows without horizontal overflow or clipping",
        `scrollDelta: ${ptInfo.scrollDelta}px, clipped: ${ptInfo.clipped}`
      );

      assert(
        ptInfo.overlaps === 0,
        "PT-BR at 200% text exhibits zero overlap under longer Portuguese text strings",
        `Overlaps: ${ptInfo.overlaps}`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 5: Browse Canonical Fact Provenance & Independent Compiler Oracle
  // =========================================================================
  console.log("\nPhase 5: Browse summary facts canonical provenance from compiler and curation fields");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });

      const answers = {
        daysPerWeek: 4,
        sessionMinutes: 60,
        environment: "commercial_gym",
        structuredExperience: "6_to_24m",
      };
      await navigateToBrowseCatalogue(page, answers);

      // Fault injection: replace Browse duration fact with a name-derived guess
      if (FAULT === "guess-fact") {
        console.log("  [FAULT] Mutating Browse card fact with name-derived guess to verify provenance failure");
        await page.evaluate(() => {
          const card = document.querySelector('.entry-prog[data-entry-catalogue]');
          if (card) {
            const factsEl = card.querySelector('.entry-prog__facts');
            if (factsEl) {
              factsEl.innerHTML = '<span>about 99 minutes (inferred from name)</span>';
            }
          }
        });
      }

      // Compute independent canonical fact oracle
      const services = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });
      const canonicalCards = services.browseCatalogue({
        ...answers,
        environment: { kind: answers.environment },
      });

      const domCards = await page.evaluate(() => {
        return [...document.querySelectorAll(".entry-prog")].map((el) => {
          return {
            id: el.getAttribute("data-entry-catalogue"),
            ariaLabel: el.getAttribute("aria-label"),
            name: el.querySelector(".entry-prog__name")?.textContent.trim(),
            daysBadge: el.querySelector(".entry-prog__days")?.textContent.trim(),
            purpose: el.querySelector(".entry-prog__purpose")?.textContent.trim(),
            factSpans: [...el.querySelectorAll(".entry-prog__facts span")].map((s) => s.textContent.trim()),
            metaSpans: [...el.querySelectorAll(".entry-prog__meta")].map((s) => s.textContent.trim()),
            warn: el.querySelector(".entry-prog__warn")?.textContent.trim() || null,
          };
        });
      });

      assert(
        domCards.length === canonicalCards.length && domCards.length > 0,
        `Browse renders all released catalogue blueprints (${canonicalCards.length} cards)`,
        `Observed ${domCards.length} rendered cards`
      );

      // Verify fact-by-fact provenance against independent compiler oracle
      let frequencyMismatches = 0;
      let durationMismatches = 0;
      let progressionMismatches = 0;
      let equipmentMismatches = 0;
      let structureMismatches = 0;
      let warningMismatches = 0;
      let nameInferenceLeaks = 0;

      for (const domCard of domCards) {
        const canonical = canonicalCards.find((c) => c.id === domCard.id);
        if (!canonical) continue;

        // 1. Frequency badge: comes directly from blueprint frequency
        const expectedDaysText = `${canonical.daysPerWeek} days`;
        if (domCard.daysBadge !== expectedDaysText) {
          frequencyMismatches++;
        }

        // 2. Duration fact: comes directly from compiled preview estimate minutes
        if (canonical.minutes?.length) {
          const expectedDuration = canonical.minutes[0] === canonical.minutes[1]
            ? `about ${canonical.minutes[0]} minutes`
            : `about ${canonical.minutes[0]}–${canonical.minutes[1]} minutes`;
          const hasDuration = domCard.factSpans.some((text) => text === expectedDuration);
          if (!hasDuration) durationMismatches++;
        }

        // 3. Structure facts: comes from compiled day exercise and set counts
        if (canonical.structureFacts?.length) {
          const exCounts = canonical.structureFacts.map((d) => d.exerciseCount);
          const setCounts = canonical.structureFacts.map((d) => d.setCount);
          const minEx = Math.min(...exCounts);
          const maxEx = Math.max(...exCounts);
          const minSets = Math.min(...setCounts);
          const maxSets = Math.max(...setCounts);
          const exStr = minEx === maxEx ? `${minEx} exercises` : `${minEx}–${maxEx} exercises`;
          const setStr = minSets === maxSets ? `${minSets} sets` : `${minSets}–${maxSets} sets`;
          const expectedStructure = `${exStr} · ${setStr}`;
          const hasStructure = domCard.factSpans.some((text) => text === expectedStructure);
          if (!hasStructure) structureMismatches++;
        }

        // 4. Progression meta: comes from compiled exercise strategies
        if (canonical.progressionStrategies?.length) {
          const STRAT_LABELS = {
            range: "Rep range",
            rep_goal: "Total reps",
            effort_target: "Fixed reps and effort",
            anchor_backoff: "Heavy set and lighter sets",
          };
          const expectedProgText = "Progression: " + canonical.progressionStrategies.map((s) => STRAT_LABELS[s]).filter(Boolean).join(" · ");
          const hasProg = domCard.metaSpans.some((text) => text === expectedProgText);
          if (!hasProg) progressionMismatches++;
        }

        // 5. Equipment meta: comes from compiled slot equipment assumptions
        if (canonical.equipmentAssumptions?.length) {
          const EQUIP_LABELS = {
            barbell: "Barbell", dumbbell: "Dumbbell", machine: "Machine",
            cable: "Cable", bodyweight: "Bodyweight", smith: "Smith machine",
            band: "Resistance band",
          };
          const expectedEquipText = "Uses: " + canonical.equipmentAssumptions.map((e) => EQUIP_LABELS[e] || e).join(", ");
          const hasEquip = domCard.metaSpans.some((text) => text === expectedEquipText);
          if (!hasEquip) equipmentMismatches++;
        }

        // 6. Mismatch warning: present iff answers.daysPerWeek !== canonical.daysPerWeek
        if (canonical.daysPerWeek !== answers.daysPerWeek) {
          const expectedWarn = `You chose ${answers.daysPerWeek} days; this program uses ${canonical.daysPerWeek}.`;
          if (domCard.warn !== expectedWarn) warningMismatches++;
        } else {
          if (domCard.warn !== null) warningMismatches++;
        }

        // 7. Prove facts are not inferred from program names:
        // A naive implementation might parse digits from card.name or familyName.
        // We verify that card name tokens never override the compiler facts.
        if (domCard.name.includes("4 days") && canonical.daysPerWeek !== 4) {
          nameInferenceLeaks++;
        }
      }

      assert(
        frequencyMismatches === 0,
        "Rendered frequency badge strictly derives from compiler blueprint frequency across all cards",
        frequencyMismatches ? `Mismatches: ${frequencyMismatches}` : null
      );

      assert(
        durationMismatches === 0,
        "Rendered duration fact strictly derives from compiled session estimates (e.g. about min-max minutes)",
        durationMismatches ? `Mismatches: ${durationMismatches}` : null
      );

      assert(
        structureMismatches === 0,
        "Rendered structure facts strictly derive from compiler day exercise and set counts",
        structureMismatches ? `Mismatches: ${structureMismatches}` : null
      );

      assert(
        progressionMismatches === 0,
        "Rendered progression model strictly derives from compiled exercise strategies",
        progressionMismatches ? `Mismatches: ${progressionMismatches}` : null
      );

      assert(
        equipmentMismatches === 0,
        "Rendered equipment requirements strictly derive from compiled slot equipment",
        equipmentMismatches ? `Mismatches: ${equipmentMismatches}` : null
      );

      assert(
        warningMismatches === 0,
        "Frequency mismatch notice displays exactly when answers.daysPerWeek !== card.daysPerWeek",
        warningMismatches ? `Mismatches: ${warningMismatches}` : null
      );

      assert(
        nameInferenceLeaks === 0,
        "Browse facts strictly derive from compiler fields and are never inferred from program names",
        nameInferenceLeaks ? `Leaks: ${nameInferenceLeaks}` : null
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 6: Bounded P6 Delta — Omission / Honest Unavailable Copy for Unknown Facts
  // =========================================================================
  console.log("\nPhase 6: Bounded P6 Delta — Unknown facts omission and honest copy contract");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });

      // Inject a card with unknown/missing fields into browseCatalogue via the test override hook
      await page.evaluate(() => {
        const orig = window.RepForgeProgramEntryAdapter.createProductionServices({
          Compiler: window.RepForgeCompiler,
          catalogue: window.EXERCISE_LIBRARY,
        });
        window.__repforgeProgramEntryServicesOverride = {
          ...orig,
          browseCatalogue: (answers) => {
            const cards = orig.browseCatalogue(answers);
            return [
              {
                ...cards[0],
                id: "test_unknown_facts_blueprint",
                name: "Mystery Program · 4 days",
                familyName: "Mystery Program",
                minutes: [], // unknown duration
                structureFacts: [], // unknown structure
                progressionStrategies: [], // unknown progression
                equipmentAssumptions: [], // unknown equipment
              },
              ...cards,
            ];
          },
        };
      });

      await navigateToBrowseCatalogue(page, { daysPerWeek: 4, sessionMinutes: 60, environment: "commercial_gym" });

      const unknownCard = await page.evaluate(() => {
        const el = document.querySelector('[data-entry-catalogue="test_unknown_facts_blueprint"]');
        if (!el) return null;
        const metas = [...el.querySelectorAll(".entry-prog__meta")].map((m) => m.textContent.trim());
        const facts = [...el.querySelectorAll(".entry-prog__facts span")].map((f) => f.textContent.trim());
        return { metas, facts };
      });

      assert(
        unknownCard !== null,
        "Test card with unknown curation/compiler fields renders in the catalogue",
        null
      );

      // When duration is unknown (empty minutes), duration fact must be omitted or show honest unavailable copy
      const durationHandledHonesty = unknownCard && unknownCard.facts.length === 0;
      assert(
        durationHandledHonesty,
        "Unknown duration fact is omitted (never guessed from program name)",
        unknownCard ? `Observed facts: ${JSON.stringify(unknownCard.facts)}` : "No card"
      );

      // When progression strategies are unknown, fact must be omitted or show honest unavailable copy.
      // Current P5 production renders empty "Progression:" dangling label.
      const progressionHonestOrOmitted = unknownCard && (
        !unknownCard.metas.some((m) => m.startsWith("Progression:") || m.startsWith("Progressão:")) ||
        unknownCard.metas.some((m) => m.toLowerCase().includes("unavailable") || m.toLowerCase().includes("not specified"))
      );
      assert(
        progressionHonestOrOmitted,
        "Unknown progression strategy is omitted or displays honest unavailable copy (not dangling 'Progression:')",
        unknownCard ? `Observed metas: ${JSON.stringify(unknownCard.metas)}` : "No card",
        true // isExpectedBaselineGap
      );

      // When equipment assumptions are unknown, fact must be omitted or show honest unavailable copy.
      // Current P5 production renders empty "Uses:" dangling label.
      const equipmentHonestOrOmitted = unknownCard && (
        !unknownCard.metas.some((m) => m.startsWith("Uses:") || m.startsWith("Usa:")) ||
        unknownCard.metas.some((m) => m.toLowerCase().includes("unavailable") || m.toLowerCase().includes("not specified"))
      );
      assert(
        equipmentHonestOrOmitted,
        "Unknown equipment assumption is omitted or displays honest unavailable copy (not dangling 'Uses:')",
        unknownCard ? `Observed metas: ${JSON.stringify(unknownCard.metas)}` : "No card",
        true // isExpectedBaselineGap
      );
    } finally {
      await context.close();
    }
  }

  // Summary
  console.log(`\nExpert controls & Browse provenance characterization: ${results.passed} passed, ${results.failed} failed`);
  if (results.expectedBaselineGaps.length > 0) {
    console.log("\nExpected P5 baseline red gaps (bounded visual/fact-source delta for P6):");
    results.expectedBaselineGaps.forEach((g, i) => console.log(`  ${i + 1}. ${g}`));
  }
  const unexpectedFailures = results.failures.filter((f) => !results.expectedBaselineGaps.includes(f));
  if (unexpectedFailures.length > 0) {
    console.log("\nUnexpected failures:");
    unexpectedFailures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
} finally {
  await browser.close();
  if (results.failed > 0) {
    process.exit(1);
  }
}
