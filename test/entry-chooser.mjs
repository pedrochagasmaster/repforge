#!/usr/bin/env node
/**
 * Entry hub structure and route parity (onboarding B, Plan 072).
 *
 * The hub offers exactly three equal choices, Recommend, Build and Import,
 * with no Browse, Custom, goal buttons or disclosure. A choice only selects
 * it; Continue enters the route. Each choice is reachable by pointer and by
 * keyboard and lands on its route's first step without changing durable
 * program state.
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

/** Independent expected-route oracle: each hub choice's route and its real first step. */
const INDEPENDENT_ROUTE_ORACLE = Object.freeze({
  recommend: Object.freeze({ route: "recommend", initialStep: "intro" }),
  build: Object.freeze({ route: "build", initialStep: "build_setup", stepSelector: "#entryProgramName" }),
  import: Object.freeze({ route: "import", initialStep: "import_source", stepSelector: "#entryImportPick, #entryFreeformIn" }),
});

/** A genuinely fresh context with no stored state, entered via landing Build. */
async function openFreshChooserHub(browser, { viaKeyboard = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

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

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  await page.waitForSelector("#firstRunCreate", { timeout: 5000 });

  if (viaKeyboard) {
    await page.locator("#firstRunCreate").focus();
    await page.keyboard.press("Enter");
  } else {
    await page.click("#firstRunCreate");
  }

  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });

  return { context, page };
}

async function inspectDurableProgramState(page) {
  return page.evaluate(async (key) => {
    let localParsed = null;
    try {
      const raw = localStorage.getItem(key);
      localParsed = raw ? JSON.parse(raw) : null;
    } catch {}
    const setupDraft = localStorage.getItem("repforge_program_setup_draft_v1");
    return {
      onboardedLocal: localParsed?.programMeta?.onboarded === true,
      programRowsLocal: (localParsed?.program || []).length,
      hasSetupDraft: setupDraft !== null,
    };
  }, STORAGE_KEY);
}

/** Inspects the hub's choice structure: how many choices, their routes, whether any is Browse/Custom. */
async function inspectHubStructure(page) {
  return page.evaluate(() => {
    const hub = document.querySelector("#onbBody .entry__hub");
    if (!hub) return { ok: false, error: "no .entry__hub found in #onbBody" };
    const choices = [...document.querySelectorAll("[data-entry-hub]")];
    return {
      ok: true,
      count: choices.length,
      routes: choices.map((el) => el.dataset.entryHub),
      hasBrowse: choices.some((el) => el.dataset.entryHub === "browse") ||
        !!document.querySelector('[data-entry-route="browse"], [data-entry-hub="browse"]'),
      hasCustom: choices.some((el) => el.dataset.entryHub === "custom") ||
        !!document.querySelector('[data-entry-route="custom"], [data-entry-hub="custom"]'),
      hasGoalButtons: !!document.querySelector("[data-entry-goal]"),
      hasOwnDisclosure: !!document.querySelector("#entryOwnToggle"),
      // A radio group is one tab stop; the arrow keys reach the rest.
      tabStops: choices.filter((el) => el.tabIndex >= 0).length,
      allRadios: choices.every((el) => el.getAttribute("role") === "radio"),
    };
  });
}

async function assertRouteStepParity(page, routeKey) {
  const expected = INDEPENDENT_ROUTE_ORACLE[routeKey];
  if (!expected) throw new Error(`Unknown route key in test oracle: ${routeKey}`);
  if (expected.stepSelector) await page.waitForSelector(expected.stepSelector, { timeout: 10000 });
  else await page.waitForFunction((step) => window.__repforgeEntryState?.()?.step === step, expected.initialStep, { timeout: 10000 });

  const clientState = await page.evaluate(() => {
    const hook = window.__repforgeEntryState;
    const state = hook ? hook() : null;
    return { route: state?.route || null, step: state?.step || null };
  });

  return {
    routeMatches: clientState.route === expected.route,
    stepMatches: clientState.step === expected.initialStep,
    clientState,
    expected,
  };
}

const browser = await launchChromium();

try {
  console.log("Entry hub structure & route parity suite (Plan 072 S2)");
  console.log(`Target URL: ${BASE}`);
  if (FAULT) {
    console.log(`Active deliberate fault switch: REPFORGE_ENTRY_CHOOSER_FAULT=${FAULT}`);
  }

  phase("Phase 1: the hub is exactly three equal choices, with no Browse, Custom, goal buttons, or disclosure");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      const structure = await inspectHubStructure(page);
      assert(structure.ok, "entry chooser hub rendered in DOM", structure.error);
      assert(structure.count === 3, "the hub offers exactly three choices", String(structure.count));
      assert(JSON.stringify([...structure.routes].sort()) === JSON.stringify(["build", "import", "recommend"]),
        "the three choices are Recommend, Build and Import", JSON.stringify(structure.routes));
      assert(!structure.hasBrowse, "no Browse option anywhere on the hub (Plan 067)");
      assert(!structure.hasCustom, "no Custom option anywhere on the hub (Plan 072 S2)");
      assert(!structure.hasGoalButtons, "no separate goal buttons on the hub (Plan 072 S2)");
      assert(!structure.hasOwnDisclosure, "no 'bring your own program' disclosure on the hub (Plan 072 S2)");
      assert(structure.allRadios, "each choice is exposed as a radio", JSON.stringify(structure.routes));
      assert(structure.tabStops === 1, "the choices are one tab stop, as a radio group", String(structure.tabStops));
    } finally {
      await context.close();
    }
  }

  phase("Phase 2: a choice only selects it; Continue is what enters the route");
  {
    const { context, page } = await openFreshChooserHub(browser);
    try {
      await page.click('[data-entry-hub="recommend"]');
      const stillOnHub = await page.locator('[data-entry-hub="recommend"]').count();
      assert(stillOnHub > 0, "tapping a choice does not leave the hub by itself");
      const selected = await page.locator('[data-entry-hub="recommend"]').getAttribute("aria-checked");
      assert(selected === "true", "the tapped choice is marked selected", String(selected));
      assert(await page.locator("#onbNext").isEnabled(), "Continue is enabled once a choice is selected");
    } finally {
      await context.close();
    }
  }

  phase("Phase 3: Route parity & isolation — all three jobs via pointer and keyboard");
  const routesToTest = ["recommend", "build", "import"];

  for (const routeKey of routesToTest) {
    const { context, page } = await openFreshChooserHub(browser, { viaKeyboard: false });
    try {
      if (routeKey === "import" && FAULT === "hide-import") {
        assert(false, `Pointer activation reaches ${routeKey} route`, "[FAULT INJECTION] Import unavailable under hide-import");
        continue;
      }
      await page.click(`[data-entry-hub="${routeKey}"]`);
      await page.click("#onbNext");

      const parity = await assertRouteStepParity(page, routeKey);
      assert(
        parity.routeMatches && parity.stepMatches,
        `Pointer activation reaches ${routeKey} on semantic first step ${parity.expected.initialStep}`,
        `Observed route: "${parity.clientState.route}", step: "${parity.clientState.step}"`
      );

      const storage = await inspectDurableProgramState(page);
      assert(
        !storage.onboardedLocal && storage.programRowsLocal === 0,
        `Pointer activation of ${routeKey} preserves empty durable program state without activation`,
        JSON.stringify(storage)
      );
    } finally {
      await context.close();
    }
  }

  for (const routeKey of routesToTest) {
    const { context, page } = await openFreshChooserHub(browser, { viaKeyboard: true });
    try {
      if (routeKey === "import" && FAULT === "hide-import") {
        assert(false, `Keyboard activation reaches ${routeKey} route`, "[FAULT INJECTION] Import unavailable under hide-import");
        continue;
      }
      // The group's one tab stop, then the arrow keys, which also choose.
      await page.locator('[data-entry-hub][tabindex="0"]').focus();
      const steps = ["recommend", "build", "import"].indexOf(routeKey);
      for (let i = 0; i < steps; i++) await page.keyboard.press("ArrowDown");
      if (!steps) await page.keyboard.press("Space");
      await page.locator("#onbNext").focus();
      await page.keyboard.press("Enter");

      const parity = await assertRouteStepParity(page, routeKey);
      assert(
        parity.routeMatches && parity.stepMatches,
        `Keyboard activation reaches ${routeKey} on semantic first step ${parity.expected.initialStep}`,
        `Observed route: "${parity.clientState.route}", step: "${parity.clientState.step}"`
      );

      const storage = await inspectDurableProgramState(page);
      assert(
        !storage.onboardedLocal && storage.programRowsLocal === 0,
        `Keyboard activation of ${routeKey} preserves empty durable program state without activation`,
        JSON.stringify(storage)
      );
    } finally {
      await context.close();
    }
  }

  console.log(`\nChooser characterization: ${results.passed} passed, ${results.failed} failed`);
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
