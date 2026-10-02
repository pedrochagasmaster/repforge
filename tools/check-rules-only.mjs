#!/usr/bin/env node
/**
 * Rules-only audit (Plan 064 R6a).
 *
 * The treatment table in docs/design/plan-064-reconciliation.md classes 64
 * states `rules only`: Direction D does not draw them, so each keeps its layout
 * and follows the shared rules (Plan 064 section 8) and nothing else. This
 * audit renders every one of them in PT and EN at 360 CSS px and checks:
 *
 *   1. orange     every element painted with the accent is on the orange budget.
 *   2. targets    every `button, a, input, [role=button]` is at least 44 x 44.
 *   3. overflow   no element is wider than its box (the Progress tab row aside).
 *   4. sheetband  every open sheet is headed by `.sheetband`; no open dialog is
 *                 unclassified (a sheet, or one of the documented non-sheets).
 *
 * Checks 1 to 3 are the Direction D gate's own machinery (`gatherEvidence`,
 * `checkOrange`, `checkTargets`, `checkOverflow` in tools/check-direction-d.mjs),
 * not a fork. The D gate's ellipsis ban is a D-surface rule (spec section 10)
 * and is not a shared rule, so it is not applied here.
 *
 * Usage:
 *   node tools/check-rules-only.mjs                        all 64 states, PT and EN
 *   node tools/check-rules-only.mjs --state settings/main  one state
 *   options: --locale pt|en  --theme light|dark  --evidence <file.json>  --verbose
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadManifest } from "./ui-screens/manifest.mjs";
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState } from "./ui-screens/screens-app.mjs";
import { dismissChrome, launchChromium, openPage, setCaptureBase, settle } from "./ui-screens/session.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
import {
  ORANGE_ALLOWLIST, ORANGE_CATEGORIES, OVERFLOW_EXCEPTIONS, checkOrange, checkOverflow, checkTargets, gateManifest, gatherEvidence, validateGateConfig,
} from "./check-direction-d.mjs";

/** The 64 screens whose treatment is `rules only` in the "Surface treatment table" (397 frames). */
export const RULES_ONLY_STATES = Object.freeze([
  "today/no-program",
  "workout/stale-draft", "workout/persist-retry", "workout/invalid-draft",
  "progress/volume", "progress/volume-block", "progress/volume-drill-in", "progress/prs", "progress/prs-drill-in",
  "progress/review", "progress/review-active", "progress/review-complete", "progress/review-insufficient",
  "progress/schedule-diagnosis", "progress/sibling-lower-frequency", "progress/sibling-shorter-session",
  "progress/guided-repair", "progress/volume-reduction-preview", "progress/recovery-ineligible", "progress/recovery-questions",
  "progress/recovery-preview", "progress/recovery-active", "progress/recovery-reassessment",
  "history/delete-confirm", "history/conflict",
  "library/list", "library/list-selected", "library/exercise-preview", "library/exercise-detail", "library/exercise-detail-glossary",
  "program/no-program", "program/progression-editor", "program/exercise-picker", "program/custom-exercise",
  "program/custom-exercise-saving", "program/custom-exercise-deleting", "program/custom-exercise-archiving",
  "program/custom-exercise-recovery", "program/share-setup", "program/share-one-blocker", "program/share-repair-return",
  "program/share-ready", "program/text-export",
  "settings/main", "settings/appearance", "settings/guides", "settings/guides-replay", "settings/privacy", "settings/privacy-disclosure",
  "install/banner", "install/ios-sheet", "install/transfer-eligible", "install/transfer-creating", "install/transfer-ready",
  "install/transfer-retryable", "install/transfer-claiming", "install/transfer-importing", "install/transfer-success",
  "install/transfer-cleanup", "install/transfer-terminal", "install/transfer-destination", "install/transfer-interrupted",
  "install/transfer-unknown", "install/transfer-claimed-expired",
]);

/**
 * Accent uses on the rules-only surfaces beyond what the D gate already lists. The categories are the same five
 * budget uses (Plan 064 section 8.8). The D list is inherited whole: the dock's active item, the CTA arrow and the
 * verdict glyph are the same budget uses on every surface.
 */
export const RULES_ONLY_EXTRA_ALLOWLIST = [];
export const RULES_ONLY_ORANGE_ALLOWLIST = [...ORANGE_ALLOWLIST, ...RULES_ONLY_EXTRA_ALLOWLIST];
export const RULES_ONLY_OVERFLOW_EXCEPTIONS = [...OVERFLOW_EXCEPTIONS];

/**
 * Open dialogs that are not sheets, so `.sheetband` does not head them. Anything else that opens as a dialog and is
 * not a `.sheet` is reported as unclassified, so a new one cannot slip past the audit.
 */
export const NON_SHEET_DIALOGS = Object.freeze([
  { selector: "#installBanner", reason: "the install prompt is a banner above the dock, not a sheet" },
  { selector: "#glossary", reason: "a definition popover anchored to its term" },
  { selector: "#firstRun", reason: "the one-time landing is a page" },
  { selector: "#sessionSummary", reason: "the session summary is a full-screen sheet drawn in Direction D (R3h)" },
  { selector: "dialog.importchoice, dialog.storage-recovery, dialog.program-editor-leave", reason: "centred modal questions that stay native" },
]);

export function validateRulesOnlyList(states, manifest, treatment = null) {
  const problems = [];
  const live = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  const seen = new Set();
  for (const key of states) {
    if (!live.has(key)) problems.push(`listed rules-only state ${key} is not in the live manifest (docs/ui-screens/manifest.json); retire it from the list or restore the screen`);
    if (seen.has(key)) problems.push(`duplicate rules-only state ${key}`);
    seen.add(key);
  }
  if (treatment) {
    for (const key of treatment) if (!seen.has(key)) problems.push(`the treatment table classes ${key} \`rules only\` but the audit does not list it`);
    for (const key of states) if (!treatment.includes(key)) problems.push(`the audit lists ${key} but the treatment table does not class it \`rules only\``);
  }
  return problems;
}

/** The states the reconciliation's treatment table classes `rules only` (its Treatment column, not the D section 3 column). */
export function readRulesOnlyTreatment() {
  const doc = readFileSync(join(ROOT, "docs/design/plan-064-reconciliation.md"), "utf8");
  return doc.split("\n").map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 8 && /^`[a-z-]+\/[a-z-]+`$/.test(cells[1]) && cells[4] === "`rules only`")
    .map((cells) => cells[1].replaceAll("`", ""));
}

/**
 * Runs in the page. Every visible sheet and dialog, and what heads it. Self-contained because Playwright serializes it.
 */
export function collectSheetEvidence(options = {}) {
  const scope = options.scope || "body";
  const root = document.querySelector(scope);
  if (!root) return { error: `scope ${scope} not found` };
  const nonSheets = options.nonSheets || [];
  const visible = (element) => {
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) return false;
      if (node.hasAttribute("hidden") || node.hasAttribute("inert")) return false;
    }
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const locator = (element) => {
    if (element.id) return `#${element.id}`;
    const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join("");
    const anchor = element.parentElement?.closest("[id]");
    return `${element.tagName.toLowerCase()}${classes}${anchor ? ` in #${anchor.id}` : ""}`;
  };
  const candidates = [root, ...root.querySelectorAll(".sheet, dialog, [role='dialog'], [role='alertdialog']")]
    .filter((element) => element.matches(".sheet, dialog, [role='dialog'], [role='alertdialog']"));
  const sheets = [], unclassified = [];
  for (const element of candidates) {
    // A native dialog is open only with the attribute; a sheet is open when it is rendered.
    if (element.tagName === "DIALOG" && !element.open) continue;
    if (!visible(element)) continue;
    if (element.matches(".sheet")) {
      const head = [...element.children].find((child) => !child.matches(".sheet-scrim"));
      const band = head && head.matches(".sheetband") ? head : null;
      sheets.push({
        locator: locator(element),
        firstChild: head ? locator(head) : null,
        headed: !!band,
        hasHandle: !!band?.querySelector(":scope > .sheetband__handle"),
        hasTitle: !!band?.querySelector(":scope > .sheetband__title"),
        legacy: [...element.querySelectorAll(".sheet__head, .sheet__grab, .installsheet__head")].filter(visible).map(locator),
      });
    } else if (!nonSheets.some((item) => element.matches(item))) {
      unclassified.push({ locator: locator(element) });
    }
  }
  return { scope, sheets, unclassified };
}

export async function gatherSheetEvidence(page, options = {}) {
  return page.evaluate(collectSheetEvidence, { nonSheets: NON_SHEET_DIALOGS.map((item) => item.selector), ...options });
}

export function checkSheetBand(evidence) {
  if (evidence.error) return [`sheetband: ${evidence.error}`];
  const failures = [];
  for (const sheet of evidence.sheets) {
    if (!sheet.headed) failures.push(`sheetband: ${sheet.locator} is headed by ${sheet.firstChild || "nothing"}, not .sheetband`);
    else if (!sheet.hasHandle || !sheet.hasTitle) failures.push(`sheetband: ${sheet.locator}'s .sheetband has no ${!sheet.hasHandle ? ".sheetband__handle" : ".sheetband__title"}`);
    // A sheet headed by something else is reported once; a legacy head left beside a band is its own finding.
    if (sheet.headed) for (const legacy of sheet.legacy) failures.push(`sheetband: ${sheet.locator} still draws a legacy head ${legacy}`);
  }
  for (const dialog of evidence.unclassified) failures.push(`sheetband: ${dialog.locator} is an open dialog that is neither a .sheet nor a documented non-sheet`);
  return failures;
}

/** Horizontal overflow only: the D gate's ellipsis ban is a D-surface rule and is not a shared rule. */
export function checkRulesOverflow(evidence) {
  return checkOverflow({ ...evidence, ellipsis: [] });
}

export const CHECKS = Object.freeze({ orange: checkOrange, targets: checkTargets, overflow: checkRulesOverflow, sheetband: checkSheetBand });

export function validateRulesOnlyConfig({ allowlist = RULES_ONLY_ORANGE_ALLOWLIST, exceptions = RULES_ONLY_OVERFLOW_EXCEPTIONS } = {}) {
  return validateGateConfig({ allowlist, exceptions });
}

export async function gatherRulesOnlyEvidence(page, options = {}) {
  const evidence = await gatherEvidence(page, { allowlist: RULES_ONLY_ORANGE_ALLOWLIST, exceptions: RULES_ONLY_OVERFLOW_EXCEPTIONS, ...options });
  return { ...evidence, sheetEvidence: await gatherSheetEvidence(page, options.scope ? { scope: options.scope } : {}) };
}

export function checkRulesOnly(evidence) {
  return [
    ...checkOrange(evidence), ...checkTargets(evidence), ...checkRulesOverflow(evidence), ...checkSheetBand(evidence.sheetEvidence),
  ];
}

/**
 * Render each state in each locale at 360 and run the four checks. Returns every finding with the state it came from.
 */
export async function runRulesOnly({
  states = RULES_ONLY_STATES, locales = ["pt", "en"], theme = "light", browser = null, manifest = loadManifest(), onProgress = () => {},
} = {}) {
  const config = [...validateRulesOnlyList(states, manifest), ...validateRulesOnlyConfig()];
  const result = { ok: false, config, rendered: [], findings: [] };
  if (config.length) return result;
  const gate = gateManifest(manifest);
  let preview = null, own = null;
  if (!browser) {
    preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
    setCaptureBase(preview.env.REPFORGE_URL);
    own = browser = await launchChromium();
  }
  try {
    for (const key of states) {
      for (const locale of locales) {
        const label = `${key} [${locale}]`;
        let context;
        try {
          if (!APP_SCENARIOS[key]) throw new Error("missing production catalog scenario");
          const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-360", theme, locale, text: "normal", motion: "normal" };
          const opened = await openPage(browser, gate, capture, appState(key, gate.locales[locale].lang), { userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key] });
          context = opened.context;
          await dismissChrome(opened.page);
          await APP_SCENARIOS[key](opened.page);
          await settle(opened.page);
          const evidence = await gatherRulesOnlyEvidence(opened.page);
          const found = [...new Set(checkRulesOnly(evidence))];
          result.rendered.push({ key, locale, findings: found.length, sheets: evidence.sheetEvidence.sheets.length });
          result.findings.push(...found.map((message) => ({ key, locale, check: message.split(":")[0], message })));
        } catch (error) {
          result.findings.push({ key, locale, check: "render", message: `render: could not be rendered: ${error.stack || error.message}` });
          result.rendered.push({ key, locale, findings: 1, sheets: 0 });
        } finally {
          await context?.close();
        }
        onProgress(label);
      }
    }
  } finally {
    await own?.close();
    preview?.cleanup();
  }
  result.ok = result.findings.length === 0;
  return result;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  const stateKey = option("--state"), locale = option("--locale"), theme = option("--theme") || "light", evidencePath = option("--evidence");
  const manifest = loadManifest();
  if (stateKey && !RULES_ONLY_STATES.includes(stateKey)) {
    console.error(`FAIL: ${stateKey} is not one of the ${RULES_ONLY_STATES.length} rules-only states`);
    process.exit(1);
  }
  const states = stateKey ? [stateKey] : [...RULES_ONLY_STATES];
  const result = await runRulesOnly({
    states, theme, manifest, locales: locale ? [locale] : ["pt", "en"], onProgress: (label) => { if (args.includes("--verbose")) console.log(`  checked ${label}`); },
  });
  const byState = new Map();
  for (const item of result.findings) byState.set(item.key, (byState.get(item.key) || 0) + 1);
  console.log(`Rules-only audit: ${states.length} states, ${result.rendered.length} renders (${theme}, 360 px), ${result.findings.length} finding(s) in ${byState.size} state(s).`);
  for (const message of result.config) console.error(`FAIL: ${message}`);
  for (const item of result.findings) console.error(`FAIL: ${item.key} [${item.locale}] ${item.message}`);
  if (evidencePath) {
    writeFileSync(evidencePath, `${JSON.stringify({
      tool: "tools/check-rules-only.mjs", theme, viewport: "phone-360", states: states.length, renders: result.rendered.length,
      budgetCategories: ORANGE_CATEGORIES, config: result.config, rendered: result.rendered, findings: result.findings,
    }, null, 2)}\n`);
    console.log(`evidence written to ${evidencePath}`);
  }
  if (!result.ok) process.exitCode = 1;
}
