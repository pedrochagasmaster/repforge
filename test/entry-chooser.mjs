#!/usr/bin/env node
/**
 * Proof-first browser test boundary for Plan 054 packet 054-P4:
 * Five-job chooser hierarchy and route parity.
 *
 * Requirements:
 * 1. Exactly one primary Recommend card.
 * 2. Custom is a visibly subordinate generated-program alternative, not a second primary.
 * 3. Browse is a separate top-level job.
 * 4. Build and Import are grouped together under one Bring-or-build disclosure/control
 *    whose collapsed trigger is keyboard reachable and correctly exposes both actions.
 * 5. All five jobs are reachable by pointer and keyboard, and each lands on its
 *    existing semantic route/first step, without activating or mutating durable program state.
 *
 * Independent expected-route oracle: does not scrape production route constants.
 * Deliberate fault switch: REPFORGE_ENTRY_CHOOSER_FAULT=hide-import.
 *
 * Run: node test/entry-chooser.mjs
 * Or:  REPFORGE_URL=http://localhost:8000/ node test/entry-chooser.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_ENTRY_CHOOSER_FAULT;
const STORAGE_KEY = "repforge_v1";
const DRAFT_KEY = "repforge_program_setup_draft_v1";
const UI_KEY = "repforge_ui_v1";

const results = { passed: 0, failed: 0, failures: [] };

function phase(title) {
  console.log(`\n${title}`);
}

function assert(condition, name, detail) {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    results.failures.push(name);
    console.log(`  ✗ ${name}`);
    if (detail != null) {
      console.log(`    ${detail}`);
    }
  }
}

/**
 * Independent expected-route oracle.
 * Declares expected route destinations, initial step identifiers, and semantic
 * DOM landmarks for each of the five entry jobs, independent of production constants.
 */
const INDEPENDENT_ROUTE_ORACLE = Object.freeze({
  recommend: Object.freeze({
    route: "recommend",
    initialStep: "desired_result",
    stepRole: "radiogroup",
    stepSelector: '[data-entry-pick="desiredResult"]',
    headingKeywords: ["goal", "desired", "primary", "training"],
  }),
  custom: Object.freeze({
    route: "custom",
    initialStep: "desired_result",
    stepRole: "radiogroup",
    stepSelector: '[data-entry-pick="desiredResult"]',
    headingKeywords: ["goal", "desired", "primary", "training"],
  }),
  browse: Object.freeze({
    route: "browse",
    initialStep: "schedule",
    stepRole: "radiogroup",
    stepSelector: '[data-entry-pick="daysPerWeek"]',
    headingKeywords: ["train", "schedule", "days", "often"],
  }),
  build: Object.freeze({
    route: "build",
    initialStep: "build_setup",
    stepSelector: "#entryProgramName",
    headingKeywords: ["build", "setup", "name", "days"],
  }),
  import: Object.freeze({
    route: "import",
    initialStep: "import_source",
    stepSelector: "#entryImportPick, #entryFreeformIn, [data-entry-import]",
    headingKeywords: ["import", "file", "source", "program"],
  }),
});

/**
 * Creates a genuinely fresh browser context with no stored state,
 * enters through the landing Build action (#firstRunCreate), and
 * waits for the chooser hub to become active.
 */
async function openFreshChooserHub(browser, { viaKeyboard = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  // Clear all storage, indexedDB, session, and cookies
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await context.clearCookies();

  // Reload to ensure fresh device boot into landing
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  // Verify generic first-run landing is active
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  await page.waitForSelector("#firstRunCreate", { timeout: 5000 });

  // Enter through landing Build action
  if (viaKeyboard) {
    await page.locator("#firstRunCreate").focus();
    await page.keyboard.press("Enter");
  } else {
    await page.click("#firstRunCreate");
  }

  // Await onboarding chooser hub
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });

  return { context, page };
}

/**
 * Inspects durable state across localStorage and IndexedDB replicas,
 * ensuring no program activation or durable mutation has occurred.
 */
async function inspectDurableProgramState(page) {
  return page.evaluate(async (key) => {
    let localParsed = null;
    try {
      const raw = localStorage.getItem(key);
      localParsed = raw ? JSON.parse(raw) : null;
    } catch {}

    let idbParsed = null;
    try {
      idbParsed = await new Promise((resolve) => {
        const req = indexedDB.open("repforge");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("kv")) return resolve(null);
          const tx = db.transaction("kv", "readonly");
          const getReq = tx.objectStore("kv").get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
      });
    } catch {}

    const setupDraft = localStorage.getItem("repforge_program_setup_draft_v1");

    return {
      onboardedLocal: localParsed?.programMeta?.onboarded === true,
      programRowsLocal: (localParsed?.program || []).length,
      onboardedIdb: idbParsed?.programMeta?.onboarded === true,
      programRowsIdb: (idbParsed?.program || []).length,
      hasSetupDraft: setupDraft !== null,
    };
  }, STORAGE_KEY);
}

/**
 * DOM evaluation helper inspecting semantic roles, aria state,
 * labels, and grouping in the entry chooser hub.
 */
async function inspectChooserStructure(page) {
  return page.evaluate(() => {
    const hub = document.querySelector("#onbBody .entry__hub");
    if (!hub) return { ok: false, error: "no .entry__hub found in #onbBody" };

    const buttons = [...document.querySelectorAll("#onbBody button, #onbBody [role='button']")];

    // Identify cards
    const cards = buttons.map((btn) => {
      const isPrimary = btn.classList.contains("entry-card--primary") ||
        btn.getAttribute("aria-roledescription") === "primary" ||
        btn.dataset.entryCardRole === "primary";

      const isSubordinate = btn.classList.contains("entry-card--subordinate") ||
        btn.classList.contains("entry-card--secondary") ||
        btn.dataset.entryCardRole === "subordinate";

      const route = btn.dataset.entryRoute || null;
      const text = btn.textContent.trim().replace(/\s+/g, " ");
      const id = btn.id || null;

      // Find preceding group label
      let groupLabel = null;
      let prev = btn.previousElementSibling;
      while (prev) {
        if (prev.classList.contains("entry__group-lab") || prev.getAttribute("role") === "heading") {
          groupLabel = prev.textContent.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }

      return {
        tag: btn.tagName.toLowerCase(),
        id,
        route,
        isPrimary,
        isSubordinate,
        groupLabel,
        text,
        classes: [...btn.classList],
        ariaPressed: btn.getAttribute("aria-pressed"),
        ariaExpanded: btn.getAttribute("aria-expanded"),
        tabIndex: btn.tabIndex,
      };
    });

    const primaryCards = cards.filter((c) => c.isPrimary);
    const recommendCard = cards.find((c) => c.route === "recommend");
    const customCard = cards.find((c) => c.route === "custom");
    const browseCard = cards.find((c) => c.route === "browse");

    // Check for Bring-or-build disclosure trigger:
    // Semantic disclosure uses <details><summary> or button[aria-expanded]
    const disclosureEl = document.querySelector(
      "#onbBody details.entry__disclosure, #onbBody details, #onbBody button[aria-expanded], #onbBody #entryOwnToggle"
    );

    let disclosureInfo = null;
    if (disclosureEl) {
      const isDetails = disclosureEl.tagName === "DETAILS";
      const trigger = isDetails ? disclosureEl.querySelector("summary") : disclosureEl;
      let groupLabel = null;
      let prev = disclosureEl.previousElementSibling;
      while (prev) {
        if (prev.classList.contains("entry__group-lab")) {
          groupLabel = prev.textContent.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }

      disclosureInfo = {
        isDetails,
        tag: trigger?.tagName.toLowerCase() || null,
        id: trigger?.id || null,
        ariaExpanded: trigger?.getAttribute("aria-expanded") || (isDetails ? String(disclosureEl.open) : null),
        ariaPressed: trigger?.getAttribute("aria-pressed") || null,
        text: trigger?.textContent.trim().replace(/\s+/g, " ") || "",
        groupLabel,
        tabIndex: trigger ? trigger.tabIndex : -1,
      };
    }

    return {
      ok: true,
      cardCount: cards.length,
      primaryCards,
      recommendCard,
      customCard,
      browseCard,
      disclosureInfo,
    };
  });
}

/**
 * Evaluates exposed actions inside the Bring-or-build disclosure.
 * Applies the deliberate test fault switch if active.
 */
async function inspectDisclosedActions(page, { fault = FAULT } = {}) {
  const result = await page.evaluate(() => {
    // Actions disclosed under Bring-or-build:
    // Look inside .entry__own or details content
    const disclosedContainer = document.querySelector(".entry__own, details.entry__disclosure > :not(summary)");
    if (!disclosedContainer) return { found: false, routes: [] };

    const buttons = [...disclosedContainer.querySelectorAll("[data-entry-route], button")];
    const routes = buttons.map((b) => b.dataset.entryRoute).filter(Boolean);
    return { found: true, routes };
  });

  let exposedRoutes = result.routes;
  if (fault === "hide-import") {
    // Deliberate test fault: test visibility/action oracle rejects Import as unavailable
    console.log("  [FAULT INJECTION] Oracle rejected Import action as unavailable under REPFORGE_ENTRY_CHOOSER_FAULT=hide-import");
    exposedRoutes = exposedRoutes.filter((r) => r !== "import");
  }

  return {
    found: result.found,
    routes: exposedRoutes,
    hasBuild: exposedRoutes.includes("build"),
    hasImport: exposedRoutes.includes("import"),
  };
}

/**
 * Verifies that the active page state matches the independent route oracle
 * and has not mutated durable program state.
 */
async function assertRouteStepParity(page, routeKey) {
  const expected = INDEPENDENT_ROUTE_ORACLE[routeKey];
  if (!expected) throw new Error(`Unknown route key in test oracle: ${routeKey}`);

  // Wait for semantic step element to appear
  await page.waitForSelector(expected.stepSelector, { timeout: 10000 });

  // Inspect client-side entry state and DOM
  const clientState = await page.evaluate(() => {
    const hook = window.__repforgeEntryState ? window.__repforgeEntryState() : (window.__repforgeOnboarding ? window.__repforgeOnboarding.entry() : null);
    return {
      route: hook?.route || null,
      step: hook?.step || null,
      heading: document.querySelector("#entryHeading")?.textContent.trim() || "",
      hasRadioGroup: !!document.querySelector("#onbBody [role='radiogroup']"),
      hasProgramName: !!document.querySelector("#entryProgramName"),
      hasImportControl: !!document.querySelector("#entryImportSource, #entryFreeformIn, #importFileInput, [data-entry-import], #entryImportPick"),
    };
  });

  const headingLower = clientState.heading.toLowerCase();
  const headingMatches = expected.headingKeywords.some((kw) => headingLower.includes(kw));

  return {
    routeMatches: clientState.route === expected.route,
    stepMatches: clientState.step === expected.initialStep,
    headingMatches,
    clientState,
    expected,
  };
}

// ---------------------------------------------------------------------------
// Test Suite Execution
// ---------------------------------------------------------------------------
const browser = await launchChromium();

try {
  console.log("Starting Plan 054 packet 054-P4 chooser hierarchy & route parity suite");
  console.log(`Target URL: ${BASE}`);
  if (FAULT) {
    console.log(`Active deliberate fault switch: REPFORGE_ENTRY_CHOOSER_FAULT=${FAULT}`);
  }

  // =========================================================================
  // Phase 1: Hierarchy — Exactly one primary Recommend card
  // =========================================================================
  phase("Phase 1: Five-job hierarchy — exactly one primary Recommend card (054-P4)");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      const structure = await inspectChooserStructure(page);
      assert(structure.ok, "entry chooser hub rendered in DOM", structure.error);

      assert(
        structure.primaryCards.length === 1,
        "exactly one primary card is presented in the chooser",
        `Observed ${structure.primaryCards.length} primary cards: [${structure.primaryCards.map((c) => `${c.route || c.id || c.text}`).join(", ")}]`
      );

      const isRecommendPrimary = structure.primaryCards.length === 1 &&
        structure.primaryCards[0].route === "recommend";
      assert(
        isRecommendPrimary,
        "Recommend is the sole primary card in the chooser",
        `Primary card routes: [${structure.primaryCards.map((c) => c.route).join(", ")}]`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 2: Hierarchy — Custom is a visibly subordinate generated alternative
  // =========================================================================
  phase("Phase 2: Five-job hierarchy — Custom is a visibly subordinate generated alternative, not a second primary (054-P4)");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      const structure = await inspectChooserStructure(page);
      assert(structure.customCard !== null, "Custom option is present in the chooser hub");

      assert(
        structure.customCard && !structure.customCard.isPrimary,
        "Custom is not designated as a co-equal primary card",
        structure.customCard ? `Custom card classes: [${structure.customCard.classes.join(" ")}]` : "Custom card missing"
      );

      assert(
        structure.customCard && structure.customCard.isSubordinate,
        "Custom is styled/designated as a visibly subordinate generated alternative",
        structure.customCard ? `Custom card classes: [${structure.customCard.classes.join(" ")}]` : "Custom card missing"
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 3: Hierarchy — Browse is a separate top-level job
  // =========================================================================
  phase("Phase 3: Five-job hierarchy — Browse is a separate top-level job (054-P4)");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      const structure = await inspectChooserStructure(page);
      assert(structure.browseCard !== null, "Browse option is present in the chooser hub");

      // In current production, Browse and Bring-or-build share the group label "Start with a program or empty days"
      const browseIsDistinctGroup = structure.browseCard &&
        structure.disclosureInfo &&
        structure.browseCard.groupLabel !== structure.disclosureInfo.groupLabel;

      assert(
        browseIsDistinctGroup,
        "Browse is presented in a distinct top-level group separate from Bring-or-build",
        `Browse group: "${structure.browseCard?.groupLabel}" vs Disclosure group: "${structure.disclosureInfo?.groupLabel}"`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 4: Hierarchy — Build and Import grouped under Bring-or-build disclosure
  // =========================================================================
  phase("Phase 4: Five-job hierarchy — Bring-or-build disclosure grouping and accessibility (054-P4)");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      const structure = await inspectChooserStructure(page);
      const disc = structure.disclosureInfo;

      assert(disc !== null, "Bring-or-build disclosure control exists in chooser DOM");

      // W3C APG disclosure requires aria-expanded="false" or native <details> without open
      const usesAriaExpanded = disc && disc.ariaExpanded !== null;
      assert(
        usesAriaExpanded,
        "Bring-or-build control uses standard disclosure semantics (aria-expanded or <details>)",
        disc ? `Observed attributes: aria-expanded="${disc.ariaExpanded}", aria-pressed="${disc.ariaPressed}"` : "None"
      );

      const isInitiallyCollapsed = disc && disc.ariaExpanded === "false";
      assert(
        isInitiallyCollapsed,
        "Bring-or-build disclosure is initially collapsed (aria-expanded='false')",
        disc ? `aria-expanded was: "${disc.ariaExpanded}"` : "None"
      );

      // Trigger must be keyboard reachable
      const isKeyboardReachable = disc && disc.tabIndex >= 0;
      assert(
        isKeyboardReachable,
        "Bring-or-build disclosure trigger is keyboard reachable (tabIndex >= 0)",
        disc ? `tabIndex: ${disc.tabIndex}` : "None"
      );

      // When collapsed, Build and Import actions must not be exposed
      const initialDisclosed = await inspectDisclosedActions(page, { fault: null });
      assert(
        !initialDisclosed.hasBuild && !initialDisclosed.hasImport,
        "Build and Import actions are not exposed while disclosure is collapsed",
        `Exposed before toggle: [${initialDisclosed.routes.join(", ")}]`
      );

      // Expand the disclosure
      if (disc?.isDetails) {
        await page.click("#onbBody details summary");
      } else {
        await page.click("#onbBody #entryOwnToggle, #onbBody button[aria-expanded]");
      }

      // Check expanded state and actions
      const expandedStructure = await inspectChooserStructure(page);
      const expandedDisc = expandedStructure.disclosureInfo;
      assert(
        expandedDisc?.ariaExpanded === "true",
        "disclosure transitions to expanded state (aria-expanded='true')",
        `Observed aria-expanded: "${expandedDisc?.ariaExpanded}"`
      );

      // Inspect disclosed actions with fault oracle
      const afterExpand = await inspectDisclosedActions(page);
      assert(
        afterExpand.hasBuild,
        "Bring-or-build disclosure exposes Build action",
        `Exposed routes: [${afterExpand.routes.join(", ")}]`
      );

      assert(
        afterExpand.hasImport,
        "Bring-or-build disclosure exposes Import action",
        `Exposed routes: [${afterExpand.routes.join(", ")}]`
      );
    } finally {
      await context.close();
    }
  }

  // =========================================================================
  // Phase 5: Route Parity & Isolation — All five jobs reachable by pointer and keyboard
  // =========================================================================
  phase("Phase 5: Route parity & isolation — all five jobs via pointer and keyboard (054-P4)");

  const routesToTest = ["recommend", "custom", "browse", "build", "import"];

  // 5A: Pointer journeys
  for (const routeKey of routesToTest) {
    const { context, page } = await openFreshChooserHub(browser, { viaKeyboard: false });
    try {
      if (routeKey === "build" || routeKey === "import") {
        // Must expand Bring-or-build disclosure first
        const disclosureTrigger = page.locator("#onbBody details summary, #onbBody button[aria-expanded], #onbBody #entryOwnToggle");
        await disclosureTrigger.waitFor({ timeout: 5000 });
        await disclosureTrigger.click();
      }

      if (routeKey === "import" && FAULT === "hide-import") {
        assert(false, `Pointer activation reaches ${routeKey} route`, "[FAULT INJECTION] Import unavailable under hide-import");
        continue;
      }

      const card = page.locator(`[data-entry-route="${routeKey}"]`);
      await card.waitFor({ timeout: 5000 });
      await card.click();

      // Verify route landing and step parity against independent oracle
      const parity = await assertRouteStepParity(page, routeKey);
      assert(
        parity.routeMatches && parity.stepMatches,
        `Pointer activation reaches ${routeKey} on semantic first step ${parity.expected.initialStep}`,
        `Observed route: "${parity.clientState.route}", step: "${parity.clientState.step}"`
      );

      // Verify durable program state was NOT mutated or activated
      const storage = await inspectDurableProgramState(page);
      assert(
        !storage.onboardedLocal && !storage.onboardedIdb &&
        storage.programRowsLocal === 0 && storage.programRowsIdb === 0,
        `Pointer activation of ${routeKey} preserves empty durable program state without activation`,
        JSON.stringify(storage)
      );
    } finally {
      await context.close();
    }
  }

  // 5B: Keyboard journeys
  for (const routeKey of routesToTest) {
    const { context, page } = await openFreshChooserHub(browser, { viaKeyboard: true });
    try {
      if (routeKey === "build" || routeKey === "import") {
        // Expand disclosure via keyboard
        const disclosureTrigger = page.locator("#onbBody details summary, #onbBody button[aria-expanded], #onbBody #entryOwnToggle");
        await disclosureTrigger.waitFor({ timeout: 5000 });
        await disclosureTrigger.focus();
        await page.keyboard.press("Enter");
      }

      if (routeKey === "import" && FAULT === "hide-import") {
        assert(false, `Keyboard activation reaches ${routeKey} route`, "[FAULT INJECTION] Import unavailable under hide-import");
        continue;
      }

      const card = page.locator(`[data-entry-route="${routeKey}"]`);
      await card.waitFor({ timeout: 5000 });
      await card.focus();
      await page.keyboard.press("Enter");

      // Verify route landing and step parity against independent oracle
      const parity = await assertRouteStepParity(page, routeKey);
      assert(
        parity.routeMatches && parity.stepMatches,
        `Keyboard activation reaches ${routeKey} on semantic first step ${parity.expected.initialStep}`,
        `Observed route: "${parity.clientState.route}", step: "${parity.clientState.step}"`
      );

      // Verify durable program state was NOT mutated or activated
      const storage = await inspectDurableProgramState(page);
      assert(
        !storage.onboardedLocal && !storage.onboardedIdb &&
        storage.programRowsLocal === 0 && storage.programRowsIdb === 0,
        `Keyboard activation of ${routeKey} preserves empty durable program state without activation`,
        JSON.stringify(storage)
      );
    } finally {
      await context.close();
    }
  }

  // Summary
  console.log(`\nFive-job chooser characterization: ${results.passed} passed, ${results.failed} failed`);
  if (results.failures.length > 0) {
    console.log("\nDetected chooser contract failures:");
    results.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
} finally {
  await browser.close();
  if (results.failed > 0) {
    process.exit(1);
  }
}
