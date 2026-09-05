#!/usr/bin/env node
/**
 * Capture the committed UI screen catalog under docs/ui-screens/screens/.
 *
 * Designers and agents read those PNGs as the visual source of truth. Re-run
 * this whenever a UI change lands so the folder stays current:
 *
 *   python3 -m http.server 8000
 *   (cd test && npm ci && npx playwright install chromium --with-deps)  # once
 *   node tools/capture-ui-screens.mjs
 *
 * The screen list, the variant matrix and every output path come from
 * docs/ui-screens/manifest.json. Add a screen there and give it a scenario in
 * tools/ui-screens/screens-*.mjs; nothing else needs editing.
 *
 * Options:
 *   --flow <id>      capture one flow (repeatable)
 *   --screen <id>    capture one flow/screen key (repeatable)
 *   --canonical      only the phone-390 light English frame of each screen
 *   --keep-going     report failures instead of aborting the commit
 *
 * A filtered run merges into a copy of the committed catalog, so the folder on
 * disk is always complete. Nothing replaces committed evidence until every
 * requested capture has succeeded.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ROOT, capturePath, captureKey, expandCaptures, loadManifest, screenKey, variantSlug } from "./ui-screens/manifest.mjs";
import { dismissChrome, launchChromium, openPage, settle } from "./ui-screens/session.mjs";
import { APP_SCENARIOS, APP_USER_AGENT, appState } from "./ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS, focusOnboardingSubject, onboardingState } from "./ui-screens/screens-onboarding.mjs";
import { buildSemanticArtifact, collectProgramEntrySemantics, normalizeSemanticRecords, validateSemanticArtifact } from "./ui-screens/semantics.mjs";
import { collectCatalogEvidence, configForCapture, validateCatalogEvidence, validateCatalogMetadata } from "./ui-screens/catalog-contract.mjs";

const MANIFEST = loadManifest();
const CATALOG_METADATA_ERRORS = validateCatalogMetadata(MANIFEST);
const KNOWN_KEY_NAMESPACES = [...new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, "i18n-en.json"), "utf8")))
  .flatMap((key) => key.split(".").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("."))))];
const KNOWN_I18N_KEYS = Object.keys(JSON.parse(readFileSync(join(ROOT, "i18n-en.json"), "utf8")));
const ARTIFACT_ROOT = join(ROOT, MANIFEST.artifactRoot);
const SEMANTIC_PATH = join(ROOT, "docs", "ui-screens", "entry-semantics.json");
const README_PATH = join(ROOT, "docs", "ui-screens", "README.md");

const SCENARIOS = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };
const BROWSER_RECYCLE_EVERY = Number(process.env.CAPTURE_RECYCLE_EVERY || 40);
const CAPTURE_ATTEMPTS = Number(process.env.CAPTURE_ATTEMPTS || 3);
/*
 * A frame spends most of its life waiting rather than computing: opening the
 * context, booting the app and settling the surface are about 1.5s of the
 * 1.7-2.4s a capture takes, and roughly 0.9s of that is deliberate sleeping.
 * A sequential sweep therefore leaves about half of a two-core machine idle.
 *
 * Each worker owns its own browser, so the recycle counter stays a private
 * per-worker concern rather than a shared mutable one that another worker's
 * in-flight capture could have closed underneath it.
 *
 * The default stays deliberately low. This tool already retries captures that
 * lose actionability races under contention, and raising concurrency raises
 * that pressure, so a higher number needs to be justified by a run on the
 * hardware in question rather than assumed from the core count.
 */
const CAPTURE_CONCURRENCY = Math.max(1, Number(process.env.CAPTURE_CONCURRENCY || 2));
const CONTRACT_ENABLED = process.env.CATALOG_CONTRACT === "1";

function parseArgs(argv) {
  const options = { flows: [], screens: [], canonical: false, keepGoing: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--flow") options.flows.push(argv[++i]);
    else if (argv[i] === "--screen") options.screens.push(argv[++i]);
    else if (argv[i] === "--canonical") options.canonical = true;
    else if (argv[i] === "--keep-going") options.keepGoing = true;
  }
  if (process.env.CAPTURE_FILTER) options.screens.push(process.env.CAPTURE_FILTER);
  return options;
}

const isOnboarding = (capture) => capture.flow.startsWith("onboarding");

function stateFor(capture) {
  const key = screenKey(capture);
  const lang = MANIFEST.locales[capture.locale].lang;
  return isOnboarding(capture) ? onboardingState(key, lang) : appState(key, lang);
}

function selectCaptures(options) {
  let captures = expandCaptures(MANIFEST);
  if (options.flows.length) captures = captures.filter((c) => options.flows.includes(c.flow));
  if (options.screens.length) captures = captures.filter((c) => options.screens.includes(screenKey(c)));
  if (options.canonical) {
    captures = captures.filter((c) =>
      c.viewport === "phone-390" && c.theme === "light" && c.locale === "en"
      && c.text === "normal" && c.motion === "normal");
  }
  return captures;
}

function writeReadme() {
  const byFlow = new Map();
  for (const screen of MANIFEST.screens) {
    if (!byFlow.has(screen.flow)) byFlow.set(screen.flow, []);
    byFlow.get(screen.flow).push(screen);
  }
  const total = expandCaptures(MANIFEST).length;
  const lines = [
    "# UI screen catalog",
    "",
    `Phone-frame captures of every user-visible Taurifer surface — ${MANIFEST.screens.length} screens,`,
    `${total} frames. This folder is the visual reference for UI and Brand Designers.`,
    "",
    "The catalog is **mobile only**. Taurifer is a phone PWA and a desktop frame was",
    "evidence nobody reviewed, so the manifest rejects non-phone viewports.",
    "",
    "## Keeping it current",
    "",
    "Whenever a change alters a user-visible surface (`index.html`, `styles.css`, `app.js`,",
    "`program-entry-adapter.js`, on-screen copy in `i18n-*.json`, sheets, onboarding, or",
    "install UI), regenerate before merging:",
    "",
    "```bash",
    "python3 -m http.server 8000",
    "REPFORGE_URL=http://localhost:8000/ node tools/capture-ui-screens.mjs",
    "```",
    "",
    "CI runs `tools/check-ui-screens.mjs` (every registered frame exists, no strays) and",
    "`tools/compare-ui-screens.mjs` (committed frames still match a fresh capture). A stale",
    "catalog fails the build — it does not pass quietly.",
    "",
    "Never hand-edit a PNG.",
    "",
    "## Release matrix",
    "",
    "Coverage is risk-based rather than a full language × theme × text-size",
    "product ([ADR 0012](../adr/0012-ui-overhaul-canonical-reconciliation.md)).",
    "Broad normal-size coverage stays in both languages for every screen; the",
    "demanding surfaces named in ADR 0012 additionally capture PT-BR at 200% text",
    "(`pt-text200`, added by Plan 050). Document and component overflow assertions",
    "run across every catalog screen — image comparison alone cannot tell a",
    "designed scroller from a failure — and contrast is audited per rendered role",
    "under WCAG 2.2 AA.",
    "",
    "## Naming",
    "",
    "```",
    "screens/<flow>/<screen>__<viewport>-<theme>-<locale>[-text200][-reduced].png",
    "```",
    "",
    "No ordinal prefixes: they encoded a capture order that went stale the moment a screen",
    "was inserted or removed. Flow order lives in the manifest and is reflected below.",
    "",
    "## Screens",
    "",
  ];
  for (const flow of MANIFEST.flows) {
    const screens = byFlow.get(flow.id) || [];
    if (!screens.length) continue;
    lines.push(`### ${flow.label}`, "");
    lines.push("| Screen | Frames | What it shows |", "| --- | --- | --- |");
    for (const screen of screens) {
      const variants = MANIFEST.variantSets[screen.variants];
      const canonical = `screens/${flow.id}/${screen.id}__${variantSlug(variants[0])}.png`;
      lines.push(`| [${screen.label}](${canonical}) | ${variants.length} | ${screen.scenario} |`);
    }
    lines.push("");
  }
  writeFileSync(README_PATH, lines.join("\n"));
}

/**
 * Install a freshly captured tree over the committed one only once every
 * requested frame succeeded, so a mid-run failure can never leave the catalog
 * half old and half new.
 */
export function replaceCatalog(stagingRoot, targetRoot, operations = {}) {
  const exists = operations.exists || existsSync;
  const rename = operations.rename || renameSync;
  const remove = operations.remove || rmSync;
  const backupRoot = `${targetRoot}.backup-${basename(stagingRoot)}`;
  let movedExisting = false;
  let installed = false;
  try {
    if (exists(targetRoot)) {
      rename(targetRoot, backupRoot);
      movedExisting = true;
    }
    rename(stagingRoot, targetRoot);
    installed = true;
  } catch (error) {
    if (installed && exists(targetRoot)) remove(targetRoot, { recursive: true, force: true });
    if (movedExisting && exists(backupRoot)) rename(backupRoot, targetRoot);
    throw error;
  }
  // Cleanup is best effort: a failure here must not enter rollback after the
  // new tree is already committed.
  if (movedExisting) {
    try { remove(backupRoot, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  if (CATALOG_METADATA_ERRORS.length) {
    console.error(`catalog contract metadata failed: ${CATALOG_METADATA_ERRORS.join("; ")}`);
    return 1;
  }
  const options = parseArgs(process.argv.slice(2));
  const captures = selectCaptures(options);
  const filtered = Boolean(options.flows.length || options.screens.length || options.canonical);
  if (!captures.length) {
    console.error("no captures matched the requested filter");
    return 1;
  }

  const stagingRoot = mkdtempSync(join(tmpdir(), "repforge-ui-screens-"));
  const semanticByKey = new Map();
  if (filtered && existsSync(SEMANTIC_PATH)) {
    const existing = JSON.parse(readFileSync(SEMANTIC_PATH, "utf8"));
    for (const record of existing.captures || []) semanticByKey.set(record.key, record.semantic);
  }

  const failures = [];
  try {
    if (filtered && existsSync(ARTIFACT_ROOT)) cpSync(ARTIFACT_ROOT, stagingRoot, { recursive: true });
    let done = 0;

    /**
     * Take one frame. Returns null on success or the failure reason, so the
     * caller can retry a capture that lost a race rather than failing the run
     * on contention. A scenario that is genuinely broken fails both attempts.
     */
    async function capture1(browser, capture, key, out) {
      let context;
      try {
        const opened = await openPage(browser, MANIFEST, capture, stateFor(capture), {
          userAgent: APP_USER_AGENT[key],
        });
        context = opened.context;
        // The tour and the install banner are drawn over the app and swallow
        // clicks. Onboarding scenarios open their own gate and must keep it.
        if (!isOnboarding(capture)) await dismissChrome(opened.page);
        await SCENARIOS[key](opened.page);
        await settle(opened.page);
        if (CONTRACT_ENABLED) {
          const contract = configForCapture(MANIFEST, capture);
          const evidence = await opened.page.evaluate(collectCatalogEvidence, contract);
          const failures = validateCatalogEvidence(evidence, contract, { knownKeyNamespaces: KNOWN_KEY_NAMESPACES, knownKeys: KNOWN_I18N_KEYS });
          if (failures.length) throw new Error(`catalog contract ${key} ${variantSlug(capture)}: ${failures.join(" | ")}`);
        }
        if (isOnboarding(capture)) {
          await focusOnboardingSubject(opened.page, key);
          const semantic = await opened.page.evaluate(collectProgramEntrySemantics);
          semanticByKey.set(captureKey(capture), normalizeSemanticRecords(semantic));
        }
        await opened.page.screenshot({ path: out, fullPage: false });
        return null;
      } catch (error) {
        return error.message.split("\n")[0];
      } finally {
        await context?.close();
      }
    }

    const work = [];
    for (const capture of captures) {
      const key = screenKey(capture);
      const out = capturePath(MANIFEST, capture, stagingRoot);
      mkdirSync(dirname(out), { recursive: true });
      if (!SCENARIOS[key]) {
        failures.push({ key, error: "no capture scenario is registered for this screen" });
        continue;
      }
      work.push({ capture, key, out });
    }

    const pending = [];
    let cursor = 0;
    /**
     * One Chromium instance does not stay healthy across a couple of hundred
     * contexts: later captures start losing actionability races on elements
     * that are demonstrably present. Each worker recycles its own browser so
     * its two-hundredth frame runs under the same conditions as its first.
     */
    async function sweepWorker() {
      let browser = await launchChromium();
      let sinceRestart = 0;
      try {
        while (cursor < work.length) {
          const item = work[cursor++];
          if (sinceRestart >= BROWSER_RECYCLE_EVERY) {
            await browser.close();
            browser = await launchChromium();
            sinceRestart = 0;
          }
          sinceRestart += 1;
          const reason = await capture1(browser, item.capture, item.key, item.out);
          if (reason) {
            pending.push({ ...item, reason });
            console.warn(`… ${item.key} ${variantSlug(item.capture)}: ${reason} (will retry)`);
          } else {
            done += 1;
            console.log(`✓ ${item.key} ${variantSlug(item.capture)}  (${done}/${captures.length})`);
          }
        }
      } finally {
        await browser.close().catch(() => {});
      }
    }
    await Promise.all(Array.from(
      { length: Math.max(1, Math.min(CAPTURE_CONCURRENCY, work.length)) },
      () => sweepWorker(),
    ));

    // Retry passes run after the first sweep, one at a time, so a capture that
    // lost a race to contention is retried on a quiet machine rather than into
    // the same pressure that failed it.
    if (pending.length) {
      let retryBrowser = await launchChromium();
      let sinceRestart = 0;
      try {
        for (let attempt = 1; attempt <= CAPTURE_ATTEMPTS - 1 && pending.length; attempt++) {
          const retrying = pending.splice(0, pending.length);
          for (const item of retrying) {
            if (sinceRestart >= BROWSER_RECYCLE_EVERY) {
              await retryBrowser.close();
              retryBrowser = await launchChromium();
              sinceRestart = 0;
            }
            sinceRestart += 1;
            const reason = await capture1(retryBrowser, item.capture, item.key, item.out);
            if (reason) {
              if (attempt === CAPTURE_ATTEMPTS - 1) {
                failures.push({ key: item.key, variant: variantSlug(item.capture), error: reason });
                console.warn(`✗ ${item.key} ${variantSlug(item.capture)}: ${reason}`);
              } else {
                pending.push({ ...item, reason });
                console.warn(`… ${item.key} ${variantSlug(item.capture)}: ${reason} (will retry)`);
              }
            } else {
              done += 1;
              console.log(`✓ ${item.key} ${variantSlug(item.capture)}  (retry ${attempt}, ${done}/${captures.length})`);
            }
          }
        }
      } finally {
        await retryBrowser.close().catch(() => {});
      }
    }

    if (!filtered) {
      const missing = expandCaptures(MANIFEST)
        .filter((capture) => !existsSync(capturePath(MANIFEST, capture, stagingRoot)));
      for (const capture of missing) {
        failures.push({ key: screenKey(capture), variant: variantSlug(capture), error: "capture output missing" });
      }
    }

    if (failures.length && !options.keepGoing) {
      console.error(`\n${failures.length} capture(s) failed; the committed catalog was left untouched:`);
      for (const failure of failures) {
        console.error(`  - ${failure.key}${failure.variant ? ` ${failure.variant}` : ""}: ${failure.error}`);
      }
      return 1;
    }

    const semanticEntries = expandCaptures(MANIFEST)
      .filter(isOnboarding)
      .map((capture) => ({ capture, key: captureKey(capture), semantic: semanticByKey.get(captureKey(capture)) }))
      .filter((entry) => entry.semantic);
    const artifact = buildSemanticArtifact(semanticEntries);
    const validation = validateSemanticArtifact(artifact);
    if (!validation.ok && !options.keepGoing) {
      console.error(`\nsemantic evidence failed validation: ${validation.reasons.join("; ")}`);
      return 1;
    }

    replaceCatalog(stagingRoot, ARTIFACT_ROOT);
    writeFileSync(SEMANTIC_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
    writeReadme();
    console.log(`\nCommitted ${captures.length - failures.length} capture(s) atomically.`);
    if (failures.length) console.warn(`${failures.length} capture(s) still failing.`);
    return failures.length ? 1 : 0;
  } finally {
    if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await main();
}
