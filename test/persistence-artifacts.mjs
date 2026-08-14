#!/usr/bin/env node
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";

const ARTIFACT_FAMILIES = [
  {
    family: "legacyStateJournal",
    property: "legacyStateJournalEntries",
    match: "exact",
    token: "repforge_pending_v1",
  },
  {
    family: "currentJournal",
    property: "currentJournalEntries",
    match: "prefix",
    token: "repforge_pending_v1:",
  },
  {
    family: "draftSidecar",
    property: "draftSidecarEntries",
    match: "prefix",
    token: "repforge_draft_v1:pending:",
  },
  {
    family: "closingMarker",
    property: "closingMarkerEntries",
    match: "prefix",
    token: "repforge_draft_v1:closing:",
  },
];

/**
 * Inventory RepForge's localStorage transaction artifacts.
 *
 * This wrapper intentionally owns the only classifier/scan loop. Callers get
 * both the four disjoint families and deterministic combined entries/keys.
 */
export async function inventoryPersistenceArtifacts(page) {
  return page.evaluate(
    ({ definitions }) => {
      const classify = (key) =>
        definitions.find((definition) =>
          definition.match === "exact"
            ? key === definition.token
            : key.startsWith(definition.token)
        ) ?? null;

      const entries = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key == null) continue;
        const definition = classify(key);
        if (definition == null) continue;

        const raw = localStorage.getItem(key);
        let parsed = false;
        let value = null;
        try {
          value = JSON.parse(raw);
          parsed = true;
        } catch {}
        entries.push({ family: definition.family, key, raw, value, parsed });
      }
      entries.sort((left, right) => left.key.localeCompare(right.key));

      const families = Object.fromEntries(
        definitions.map((definition) => [
          definition.property,
          entries.filter((entry) => entry.family === definition.family),
        ])
      );
      const pendingEntries = [
        ...families.legacyStateJournalEntries,
        ...families.currentJournalEntries,
      ].sort((left, right) => left.key.localeCompare(right.key));
      const draftArtifacts = [
        ...families.draftSidecarEntries,
        ...families.closingMarkerEntries,
      ].sort((left, right) => left.key.localeCompare(right.key));

      return {
        ...families,
        entries,
        keys: entries.map((entry) => entry.key),
        // Compatibility aliases used by the focused transaction suites.
        legacyPendingEntries: families.legacyStateJournalEntries,
        currentPendingEntries: families.currentJournalEntries,
        pendingEntries,
        draftPendingEntries: families.draftSidecarEntries,
        closingEntries: families.closingMarkerEntries,
        draftArtifacts,
        persistenceArtifacts: entries,
      };
    },
    { definitions: ARTIFACT_FAMILIES }
  );
}

/**
 * Remove only the four classified artifact families and prove they are gone.
 */
export async function clearPersistenceArtifacts(page) {
  const before = await inventoryPersistenceArtifacts(page);
  if (before.keys.length > 0) {
    await page.evaluate((keys) => {
      for (const key of keys) localStorage.removeItem(key);
    }, before.keys);
  }

  const after = await inventoryPersistenceArtifacts(page);
  if (after.keys.length > 0) {
    throw new Error(
      `persistence artifact clear left matching keys: ${JSON.stringify(after.keys)}`
    );
  }
  return { before, after };
}

async function waitForAppBoot(page) {
  // The storage test export is assigned while app.js is still parsing. Day
  // tabs are rendered by init() only after async replica recovery and any
  // first-run persistence complete; they stay attached beneath onboarding.
  await page.waitForFunction(
    () =>
      document.readyState === "complete" &&
      typeof window.__repforgeStorage?.flush === "function" &&
      document.querySelector("#dayTabs button") !== null,
    undefined,
    { timeout: 15000 }
  );
}

export async function runPersistenceArtifactsSelfTest() {
  console.log("Persistence artifact helper self-test");
  console.log(`Target: ${BASE}\n`);

  const expectedKeys = [
    "repforge_pending_v1",
    "repforge_pending_v1:self-test-current",
    "repforge_draft_v1:pending:self-test-sidecar",
    "repforge_draft_v1:closing:self-test-marker",
  ].sort();
  const failures = [];
  let passed = 0;
  const check = (condition, message, detail) => {
    if (condition) {
      passed++;
      console.log(`  ✓ ${message}`);
      return;
    }
    failures.push(message);
    console.error(`  ✗ ${message}`);
    if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
  };

  const browser = await launchChromium();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    await clearPersistenceArtifacts(page);
    await page.evaluate((keys) => {
      keys.forEach((key, index) => {
        localStorage.setItem(key, JSON.stringify({ familySeed: index + 1 }));
      });
    }, expectedKeys);

    const inventory = await inventoryPersistenceArtifacts(page);
    check(
      inventory.legacyStateJournalEntries.length === 1 &&
        inventory.currentJournalEntries.length === 1 &&
        inventory.draftSidecarEntries.length === 1 &&
        inventory.closingMarkerEntries.length === 1,
      "inventory exposes one entry in each artifact family",
      inventory
    );
    check(
      JSON.stringify(inventory.keys) === JSON.stringify(expectedKeys) &&
        inventory.entries.length === 4 &&
        inventory.entries.every(
          (entry) =>
            entry.raw === JSON.stringify(entry.value) &&
            entry.parsed &&
            Number.isInteger(entry.value?.familySeed)
        ),
      "combined inventory retains exactly all four keys, raw bytes, and parsed values",
      inventory
    );

    await clearPersistenceArtifacts(page);
    const cleared = await inventoryPersistenceArtifacts(page);
    check(
      cleared.keys.length === 0 && cleared.entries.length === 0,
      "clear removes and verifies all four artifact families",
      cleared
    );
  } finally {
    await clearPersistenceArtifacts(page).catch(() => {});
    await context.close();
    await browser.close();
  }

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length > 0) {
    throw new Error(`persistence artifact helper self-test: ${failures.length} failed`);
  }
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun && process.argv.includes("--self-test")) {
  runPersistenceArtifactsSelfTest().catch((error) => {
    console.error("Self-test crashed:", error);
    process.exitCode = 1;
  });
}
