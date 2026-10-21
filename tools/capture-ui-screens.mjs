#!/usr/bin/env node
/**
 * Capture the committed UI screen catalog under docs/ui-screens/screens/.
 *
 * Designers and agents read those PNGs as the visual source of truth. Re-run
 * this whenever a UI change lands so the folder stays current:
 *
 *   (cd test && npm ci && npx playwright install chromium --with-deps)  # once
 *   node tools/capture-ui-screens.mjs --affected --accept-visual-change
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
 *   --shard k/n      only every n-th frame, starting at the k-th (CI splits the sweep this way)
 *   --verify         compare a fresh capture against the committed catalog and
 *                    leave the working tree untouched; the full lane (ci-full)
 *                    runs it over every frame, PR CI over the critical matrix
 *
 * A filtered run merges into a copy of the committed catalog, so the folder on
 * disk is always complete. Nothing replaces committed evidence until every
 * requested capture has succeeded.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ROOT, capturePath, captureKey, expandCaptures, loadManifest, screenKey, variantSlug } from "./ui-screens/manifest.mjs";
import { dismissChrome, launchChromium, openPage, settle, setCaptureBase } from "./ui-screens/session.mjs";
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState, finishAppCapture } from "./ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS, focusOnboardingSubject, onboardingState } from "./ui-screens/screens-onboarding.mjs";
import { buildSemanticArtifact, collectProgramEntrySemantics, normalizeSemanticRecords, validateSemanticArtifact } from "./ui-screens/semantics.mjs";
import { collectCatalogEvidence, configForCapture, validateCatalogEvidence, validateCatalogMetadata } from "./ui-screens/catalog-contract.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
import { changedFilesForEdit, changedFilesForPacket } from "./test-selection.mjs";
import { selectVisuals } from "./ci-selection.mjs";
import { checkCatalog } from "./check-ui-screens.mjs";
import { compareCatalog } from "./compare-ui-screens.mjs";
import { parseShard } from "../test/suites.mjs";

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

function parseArgs(argv) {
  const options = { flows: [], screens: [], canonical: false, keepGoing: false, affected: false, listAffected: false, acceptVisualChange: false, verify: false, shard: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--flow") options.flows.push(argv[++i]);
    else if (argv[i] === "--screen") options.screens.push(argv[++i]);
    else if (argv[i] === "--canonical") options.canonical = true;
    else if (argv[i] === "--keep-going") options.keepGoing = true;
    else if (argv[i] === "--verify") options.verify = true;
    else if (argv[i] === "--shard") options.shard = parseShard(argv[++i]);
    else if (argv[i] === "--affected") options.affected = true;
    else if (argv[i] === "--list-affected") options.listAffected = true;
    else if (argv[i] === "--accept-visual-change") options.acceptVisualChange = true;
    else if (argv[i] === "--base" && argv[i + 1]) options.base = argv[++i];
    else throw new Error(`Unknown or incomplete capture argument: ${argv[i]}`);
  }
  if (process.env.CAPTURE_FILTER) options.screens.push(process.env.CAPTURE_FILTER);
  if (options.verify && (options.affected || options.listAffected || options.acceptVisualChange || options.keepGoing)) {
    throw new Error("--verify compares against the committed catalog and cannot be combined with --affected, --accept-visual-change or --keep-going");
  }
  return options;
}

const isOnboarding = (capture) => capture.flow.startsWith("onboarding");

function stateFor(capture) {
  const key = screenKey(capture);
  const lang = MANIFEST.locales[capture.locale].lang;
  return isOnboarding(capture) ? onboardingState(key, lang) : appState(key, lang);
}

export function selectCaptures(options, manifest = MANIFEST) {
  let captures = expandCaptures(manifest);
  if (options.flows?.length) captures = captures.filter((c) => options.flows.includes(c.flow));
  if (options.screens?.length) captures = captures.filter((c) => options.screens.includes(screenKey(c)));
  if (options.canonical) {
    captures = captures.filter((c) =>
      c.viewport === "phone-390" && c.theme === "light" && c.locale === "en"
      && c.text === "normal" && c.motion === "normal");
  }
  // Stripe rather than chunk: the expansion is screen-major, so every shard
  // gets a similar mix of cheap and expensive screens and their variants.
  if (options.shard) captures = captures.filter((_, index) => index % options.shard.count === options.shard.index - 1);
  return captures;
}

/**
 * The CI gate. A fresh capture (or the requested shard of one) is compared in
 * its staging tree against the committed catalog; nothing under docs/ is
 * rewritten, so the committed frames are the immutable baseline by construction.
 * Failing frames are copied beside the runner's evidence when it provides a
 * directory, so a red run can be inspected without recapturing.
 */
export function verifyCatalog({ stagingRoot, semanticArtifact, artifactDir = process.env.REPFORGE_ARTIFACT_DIR, manifest = MANIFEST,
  baselineRoot = ARTIFACT_ROOT, baselineSemanticPath = SEMANTIC_PATH } = {}) {
  const currentSemanticPath = join(stagingRoot, "..", `${basename(stagingRoot)}-entry-semantics.json`);
  writeFileSync(currentSemanticPath, `${JSON.stringify(semanticArtifact, null, 2)}\n`);
  try {
    const registration = checkCatalog(manifest, stagingRoot);
    const comparison = compareCatalog({ manifest, baselineRoot, currentRoot: stagingRoot, baselineSemanticPath, currentSemanticPath });
    const ok = !registration.length && comparison.ok;
    console.log(`Registration: ${registration.length ? `${registration.length} problem(s)` : "complete"}`);
    for (const problem of registration.slice(0, 24)) console.log(`  - ${problem}`);
    console.log(`Perceptual comparison: ${comparison.compared}/${comparison.expected} frames match the committed catalog`);
    for (const failure of comparison.failures.slice(0, 24)) console.log(`  - ${failure.path}: ${failure.reasons.join("; ")}`);
    if (comparison.failures.length > 24) console.log(`  ... ${comparison.failures.length - 24} more failure(s)`);
    console.log(`Semantic comparison: ${comparison.semantic.ok ? "exact match" : "failed"}`);
    for (const reason of (comparison.semantic.reasons || []).slice(0, 12)) console.log(`  - ${reason}`);
    if (artifactDir) {
      const failures = join(artifactDir, "visual-failures");
      for (const failure of comparison.failures) {
        for (const [label, root] of [["baseline", baselineRoot], ["current", stagingRoot]]) {
          const source = join(root, failure.path);
          if (!existsSync(source)) continue;
          const target = join(failures, label, failure.path);
          mkdirSync(dirname(target), { recursive: true });
          cpSync(source, target);
        }
      }
      if (!comparison.semantic.ok) {
        mkdirSync(failures, { recursive: true });
        cpSync(currentSemanticPath, join(failures, "current-entry-semantics.json"));
      }
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, "visual-report.json"), `${JSON.stringify({ ok, registration, comparison }, null, 2)}\n`);
    }
    if (!ok) {
      console.error("\nThe committed catalog no longer matches the app. Regenerate and review it:");
      console.error("  node tools/capture-ui-screens.mjs --affected --accept-visual-change");
    }
    return ok;
  } finally {
    rmSync(currentSemanticPath, { force: true });
  }
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
    "node tools/capture-ui-screens.mjs --affected --accept-visual-change",
    "```",
    "",
    "Pull-request CI checks catalog registration (`tools/check-ui-screens.mjs`) and compares",
    "the critical matrix in `tools/critical-ui.mjs` with fresh production captures. The full",
    "lane (`ci-full`, on every push to main and nightly) verifies every frame with",
    "`tools/capture-ui-screens.mjs --verify`. A stale catalog fails main loudly.",
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
    "## Contextual guides",
    "",
    "A contextual guide is a modal dialog, and the rendered-role audits skip what a modal",
    "makes inert. Every state is therefore drawn on a device whose guides have been read, so",
    "each surface is audited whole, and each of the eight guides has its own state that",
    "replays it over its real surface: the `*-guide` states and `settings/guides-replay`.",
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

/** Observe a settled production frame before another consumer mutates it. */
export async function observeCatalogFrame(page, capture, { out, semanticByKey = new Map() } = {}) {
  if (typeof out !== "string" || !out) throw new Error("Catalog observation requires a fresh output path");
  // A failed/omitted write must leave no copied baseline at this frame's path.
  rmSync(out, { force: true });
  const key = screenKey(capture);
  let whyGeometry = null;
  let chartGeometry = null;
  const sameWhyViewport = (first, second) => JSON.stringify([
    first?.scroll, first?.geometry?.article, first?.geometry?.context, first?.geometry?.heading,
    first?.geometry?.cue, first?.geometry?.why,
  ]) === JSON.stringify([
    second?.scroll, second?.geometry?.article, second?.geometry?.context, second?.geometry?.heading,
    second?.geometry?.cue, second?.geometry?.why,
  ]);
  const sameChartViewport = (first, second) => JSON.stringify([
    first?.route, first?.scroll, first?.metricSelected, first?.viewport, first?.geometry,
  ]) === JSON.stringify([
    second?.route, second?.scroll, second?.metricSelected, second?.viewport, second?.geometry,
  ]);
  if (key === "progress/exercise-chart") {
    chartGeometry = await page.evaluate(() => {
      const tracker = window.__exerciseChartViewport;
      if (!tracker?.routeSettled || !tracker?.settled) return null;
      tracker.captured = tracker.snapshot();
      return tracker.report();
    });
    const chartFocused = chartGeometry?.viewportDecision?.focusChart === true;
    const largeText = capture.text === "text200";
    const frame = chartGeometry?.captured;
    if (!chartGeometry || !chartGeometry.viewportDecision || !frame || chartGeometry.pendingScrollOwners.length
      || frame.route.activeView !== "exercise" || frame.route.pushing || !frame.metricSelected
      || !sameChartViewport(chartGeometry.settled, frame)
      || chartGeometry.scrollEventCount !== chartGeometry.settled.scrollEventCount
      || (chartFocused && (Math.abs(frame.geometry.metricGroup?.top ?? Infinity) > 1
        || !frame.geometry.plotWithinViewport || !frame.geometry.readoutWithinViewport))
      || (!chartFocused && Math.abs(frame.scroll.windowY) > 1)
      || (!largeText && chartFocused)) {
      throw new Error(`Exercise chart capture geometry did not remain at its intended viewport: ${JSON.stringify(chartGeometry)}`);
    }
  }
  if (key === "workout/why-manual" || key === "workout/why-setup") {
    whyGeometry = await page.evaluate(() => {
      const tracker = window.__whyCatalogViewport;
      if (!tracker?.beforeClick || !tracker?.afterSheet) return null;
      tracker.captured = tracker.snapshot();
      return tracker.report();
    });
    if (!whyGeometry || whyGeometry.captured.selectedExerciseId !== whyGeometry.exerciseId
      || whyGeometry.captured.geometry.whySheetOpen !== true || whyGeometry.pendingScrollOwners.length
      || !sameWhyViewport(whyGeometry.beforeClick, whyGeometry.afterSheet)
      || !sameWhyViewport(whyGeometry.afterSheet, whyGeometry.captured)
      || whyGeometry.scrollEventCount !== whyGeometry.afterSheet.scrollEventCount) {
      throw new Error(`Why capture geometry did not remain stable through sheet opening: ${JSON.stringify(whyGeometry)}`);
    }
  }
  const contract = configForCapture(MANIFEST, capture);
  const evidence = await page.evaluate(collectCatalogEvidence, contract);
  const contractFailures = validateCatalogEvidence(evidence, contract, { knownKeyNamespaces: KNOWN_KEY_NAMESPACES, knownKeys: KNOWN_I18N_KEYS });
  if (contractFailures.length) throw new Error(`catalog contract ${key} ${variantSlug(capture)}: ${contractFailures.join(" | ")}`);
  if (isOnboarding(capture)) {
    await focusOnboardingSubject(page, key);
    const semantic = await page.evaluate(collectProgramEntrySemantics);
    semanticByKey.set(captureKey(capture), normalizeSemanticRecords(semantic));
  }
  await page.screenshot({ path: out, fullPage: false });
  if (whyGeometry) {
    const captured = await page.evaluate(() => {
      const tracker = window.__whyCatalogViewport;
      if (!tracker) return null;
      tracker.captured = tracker.snapshot();
      const report = tracker.report();
      tracker.stop();
      return report;
    });
    if (!captured || captured.pendingScrollOwners.length
      || !sameWhyViewport(whyGeometry.afterSheet, captured.captured)
      || captured.scrollEventCount !== captured.afterSheet.scrollEventCount) {
      throw new Error(`Why viewport changed during screenshot capture: ${JSON.stringify(captured)}`);
    }
    whyGeometry = captured;
    const artifactDir = process.env.REPFORGE_ARTIFACT_DIR;
    if (artifactDir) {
      const evidence = join(artifactDir, "why-capture-geometry", `${key.replace("/", "__")}__${variantSlug(capture)}.json`);
      mkdirSync(dirname(evidence), { recursive: true });
      writeFileSync(evidence, `${JSON.stringify(whyGeometry, null, 2)}\n`);
    }
  }
  if (chartGeometry) {
    const captured = await page.evaluate(() => {
      const tracker = window.__exerciseChartViewport;
      if (!tracker) return null;
      tracker.captured = tracker.snapshot();
      const report = tracker.report();
      tracker.stop();
      return report;
    });
    if (!captured || captured.pendingScrollOwners.length
      || !sameChartViewport(chartGeometry.settled, captured.captured)
      || !sameChartViewport(chartGeometry.captured, captured.captured)
      || captured.scrollEventCount !== chartGeometry.scrollEventCount) {
      throw new Error(`Exercise chart viewport changed during screenshot capture: ${JSON.stringify(captured)}`);
    }
    chartGeometry = captured;
    const artifactDir = process.env.REPFORGE_ARTIFACT_DIR;
    if (artifactDir) {
      const evidence = join(artifactDir, "exercise-chart-viewport", `${key.replace("/", "__")}__${variantSlug(capture)}`);
      mkdirSync(dirname(evidence), { recursive: true });
      writeFileSync(`${evidence}.json`, `${JSON.stringify(chartGeometry, null, 2)}\n`);
      cpSync(out, `${evidence}.png`);
    }
  }
}

async function main(options = parseArgs(process.argv.slice(2))) {
  if (CATALOG_METADATA_ERRORS.length) {
    console.error(`catalog contract metadata failed: ${CATALOG_METADATA_ERRORS.join("; ")}`);
    return 1;
  }
  const captures = selectCaptures(options);
  const filtered = Boolean(options.flows.length || options.screens.length || options.canonical || options.shard);
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
      let context, page, failure = null;
      let whyGeometry = null;
      let chartGeometry = null;
      const sameWhyViewport = (first, second) => JSON.stringify([
        first?.scroll, first?.geometry?.article, first?.geometry?.context, first?.geometry?.heading,
        first?.geometry?.cue, first?.geometry?.why,
      ]) === JSON.stringify([
        second?.scroll, second?.geometry?.article, second?.geometry?.context, second?.geometry?.heading,
        second?.geometry?.cue, second?.geometry?.why,
      ]);
      const sameChartViewport = (first, second) => JSON.stringify([
        first?.route, first?.scroll, first?.metricSelected, first?.viewport, first?.geometry,
      ]) === JSON.stringify([
        second?.route, second?.scroll, second?.metricSelected, second?.viewport, second?.geometry,
      ]);
      try {
        const opened = await openPage(browser, MANIFEST, capture, stateFor(capture), {
          userAgent: APP_USER_AGENT[key],
          now: APP_CLOCK[key],
        });
        context = opened.context;
        page = opened.page;
        // The tour and the install banner are drawn over the app and swallow
        // clicks. Onboarding scenarios open their own gate and must keep it.
        if (!isOnboarding(capture)) await dismissChrome(opened.page);
        await SCENARIOS[key](opened.page);
        await settle(opened.page);
        await observeCatalogFrame(opened.page, capture, { out, semanticByKey });
      } catch (error) {
        failure = error.message.split("\n")[0];
      } finally {
        try { await finishAppCapture(page); }
        catch (error) { failure = [failure, `After capture: ${error.message}`].filter(Boolean).join("; "); }
        try { await context?.close(); }
        catch (error) { failure = [failure, `Context cleanup: ${error.message}`].filter(Boolean).join("; "); }
      }
      return failure;
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

    for (const item of pending) {
      failures.push({key:item.key,variant:variantSlug(item.capture),error:item.reason});
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

    if (options.verify) {
      console.log(`\nCaptured ${captures.length} frame(s) into staging; comparing against the committed catalog.`);
      return verifyCatalog({ stagingRoot, semanticArtifact: artifact }) ? 0 : 1;
    }

    replaceCatalog(stagingRoot, ARTIFACT_ROOT);
    writeFileSync(SEMANTIC_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
    writeReadme();
    console.log(`\nCommitted ${captures.length - failures.length} capture(s) atomically.`);
    if (failures.length) console.warn(`${failures.length} capture(s) still failing.`);
    return failures.length ? 1 : 0;
  } finally {
    await cleanupProgramLabCapture();
    if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.affected || options.listAffected) {
      if (options.screens.length || options.flows.length) throw new Error("--affected cannot be combined with --screen or --flow");
      const changed = options.base ? changedFilesForPacket({ cwd: ROOT, base: options.base }) : changedFilesForEdit({ cwd: ROOT });
      const plan = selectVisuals(changed.files, MANIFEST, { cwd: ROOT,
        base: options.base || (changed.base === "HEAD (working tree)" ? "HEAD" : changed.base) });
      console.log(`Visual scope ${plan.mode}: ${plan.reason}`);
      if (options.listAffected) {
        for (const screen of plan.screens) console.log(screen);
        process.exit(0);
      }
      if (plan.mode === "none") process.exit(0);
      if (plan.mode === "screens") options.screens = plan.screens;
    }
    const baseline = options.affected ? mkdtempSync(join(tmpdir(), "repforge-visual-baseline-")) : null;
    if (baseline) {
      cpSync(ARTIFACT_ROOT, join(baseline, "screens"), { recursive: true });
      cpSync(SEMANTIC_PATH, join(baseline, "entry-semantics.json"));
    }
    const preview = await maybeStartLocalPreview([{ lane: "entry" }], { cwd: ROOT });
    const previous = process.env.REPFORGE_URL;
    try {
      process.env.REPFORGE_URL = preview.env.REPFORGE_URL;
      setCaptureBase(preview.env.REPFORGE_URL);
      process.exitCode = await main(options);
    } finally {
      if (previous === undefined) delete process.env.REPFORGE_URL;
      else process.env.REPFORGE_URL = previous;
      preview.cleanup();
    }
    if (baseline) {
      try {
        if (!process.exitCode) {
          execFileSync(process.execPath, ["tools/check-ui-screens.mjs"], { cwd: ROOT, stdio: "inherit" });
          try {
            execFileSync(process.execPath, ["tools/compare-ui-screens.mjs", "--baseline", join(baseline, "screens"),
              "--baseline-semantic", join(baseline, "entry-semantics.json")], { cwd: ROOT, stdio: "inherit" });
          } catch (error) {
            if (!options.acceptVisualChange) throw error;
            console.log("Visual baseline changed intentionally; review the updated catalog before committing.");
          }
        }
      } finally { rmSync(baseline, { recursive: true, force: true }); }
    }
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}
