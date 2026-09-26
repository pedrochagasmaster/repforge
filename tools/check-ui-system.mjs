#!/usr/bin/env node
/** Live Plan 058 role inventory. Existing CSS literals are debt until P6. */
import { readFileSync } from "node:fs";
import { ROOT, loadManifest, screenKey } from "./ui-screens/manifest.mjs";
import { loadRoleInventory, validateRoleInventory, cssLiteralDebt } from "./ui-system-core.mjs";
import { APP_SCENARIOS, APP_USER_AGENT, appState } from "./ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS, onboardingState } from "./ui-screens/screens-onboarding.mjs";
import { setCaptureBase, launchChromium, openPage, dismissChrome, settle } from "./ui-screens/session.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
import { join } from "node:path";

export function inspectRoleCoverage({ key, components, exceptions, progressCandidateSelectors, allowProgressDebt = false }) {
  const progressSelectors = [...new Set([...progressCandidateSelectors, "progress", "[role='progressbar']"])];
  const visible = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden"
      && !node.matches(".visually-hidden") && !node.closest("[inert],.visually-hidden");
  };
  const interactive = "button,input:not([type='hidden']),select,textarea,a[href],summary,[role='button'],[role='tab'],[role='radio'],[role='checkbox'],[role='switch'],[role='slider']";
  const candidate = new Set([...document.querySelectorAll(interactive)].filter(visible));
  for (const item of components) for (const node of document.querySelectorAll(item.selector)) if (visible(node)) candidate.add(node);
  for (const item of exceptions) for (const node of document.querySelectorAll(item.selector)) if (visible(node)) candidate.add(node);
  const castsOutwardShadow = (shadow) => {
    if (shadow === "none") return false;
    const layers = []; let part = "", depth = 0;
    for (const char of shadow) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) { layers.push(part); part = ""; }
      else part += char;
    }
    layers.push(part);
    return layers.some((layer) => {
      if (/\binset\b/.test(layer)) return false;
      const lengths = layer.replace(/rgba?\([^)]*\)/g, "").match(/-?\d+(?:\.\d+)?px/g) || [];
      // A zero-offset, zero-blur spread is a focus/validation ring, not a
      // raised layer. This distinction keeps real nested shadows detectable.
      return lengths.length < 3 || lengths.slice(0, 3).some((length) => parseFloat(length) !== 0);
    });
  };
  for (const selector of progressSelectors) for (const node of document.querySelectorAll(selector)) if (visible(node)) candidate.add(node);
  for (const node of document.querySelectorAll("[role='dialog'],dialog[open],.sheet-scrim")) if (visible(node)) candidate.add(node);
  for (const node of document.querySelectorAll("body *")) {
    const shadow = getComputedStyle(node).boxShadow;
    if (shadow !== "none" && visible(node)) candidate.add(node);
  }
  const problems = [], observed = [], matched = new Set(), matchedExceptions = new Set();
  const label = (node) => node.id ? `#${node.id}` : node.classList.length ? `${node.tagName.toLowerCase()}.${[...node.classList].slice(0, 2).join(".")}` : node.tagName.toLowerCase();
  for (const node of candidate) {
    const matches = components.filter((item) => node.matches(item.selector));
    const exception = exceptions.find((item) => node.matches(item.selector));
    if (exception) {
      matchedExceptions.add(exception.selector);
      if (!exception.catalogStates.includes(key)) problems.push(`${key}: ${label(node)} uses exception ${exception.selector} outside its catalog states`);
    }
    if (matches.length !== 1) {
      if (matches.length === 0 && exception) continue;
      problems.push(`${key}: ${label(node)} ${matches.length ? `ambiguous roles ${matches.map((item) => item.selector).join(" | ")}` : "has no inventory role"}`);
      continue;
    }
    const item = matches[0];
    matched.add(item.id);
    if (!item.catalogStates.includes(key)) problems.push(`${key}: ${label(node)} used outside ${item.selector}'s catalog states`);
    const actionRole = node.getAttribute("data-action-role");
    const expectedControl = { expansion: "disclosure", navigation: "quiet-navigation", removal: "destructive", replacement: "secondary" }[actionRole];
    if (expectedControl && item.roles.control !== expectedControl) {
      problems.push(`${key}: ${label(node)} ${actionRole} action is ${item.roles.control || "unassigned"}, expected ${expectedControl}`);
    }
    const actualStates = [
      ["disabled", node.matches(":disabled,[aria-disabled='true'],.is-disabled")],
      ["selected", node.matches("[aria-selected='true'],[aria-checked='true'],.is-selected,.is-active")],
      ["expanded", node.matches("[aria-expanded='true']")],
      ["validation-error", node.matches("[aria-invalid='true']")],
      ["loading", node.matches("[aria-busy='true'],.is-loading")],
    ];
    for (const [state, present] of actualStates) {
      if (present && item.roles.control && !item.states.includes(state)) problems.push(`${key}: ${label(node)} uses unowned ${state} state`);
    }
    const shadow = getComputedStyle(node).boxShadow;
    const outwardShadow = castsOutwardShadow(shadow);
    const elevation = Array.isArray(item.roles.elevation) ? item.roles.elevation : [item.roles.elevation];
    if (outwardShadow && !elevation.some((role) => ["selected", "floating", "modal", "persistent-action"].includes(role)) && !exception) {
      problems.push(`${key}: ${label(node)} casts an outward shadow without an elevation role`);
    }
    if (outwardShadow) {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const parentShadow = getComputedStyle(parent).boxShadow;
        if (!castsOutwardShadow(parentShadow)) continue;
        const trueOverlay = elevation.some((role) => role === "modal" || role === "floating") && ["fixed", "absolute"].includes(getComputedStyle(node).position);
        if (!elevation.includes("selected") && !trueOverlay && !exception) problems.push(`${key}: ${label(node)} creates nested elevation inside ${label(parent)}`);
        break;
      }
    }
    if (progressSelectors.some((selector) => node.matches(selector)) && !exception) {
      const dimension = node.getAttribute("data-progress-dimension");
      const scope = node.getAttribute("data-progress-scope");
      const allowed = Array.isArray(item.roles.progress) ? item.roles.progress : [item.roles.progress];
      if (!dimension || !scope || !allowed.includes(dimension) || item.progressScopes?.[scope] !== dimension) {
        const issue = `${key}: ${label(node)} progress needs declared dimension/scope; expected ${Object.entries(item.progressScopes || {}).map(([name, value]) => `${value}/${name}`).join("|")}, got ${dimension || "none"}/${scope || "none"}`;
        if (!allowProgressDebt) problems.push(issue);
      }
    }
    observed.push({ selector: item.selector, role: item.roles, label: label(node) });
  }
  for (const item of components) {
    if (!item.catalogStates.includes(key)) continue;
    try { document.querySelector(item.selector); } catch { problems.push(`${key}: invalid selector ${item.selector}`); }
  }
  return { key, problems, observed, matched: [...matched], matchedExceptions: [...matchedExceptions] };
}

export async function auditCatalog({ allowProgressDebt = false, flow = null, stateKey = null, onProgress = () => {} } = {}) {
  const manifest = loadManifest();
  const inventory = loadRoleInventory();
  const problems = validateRoleInventory(inventory, manifest);
  if (problems.length) return { problems, screens: 0, matched: [] };
  if (flow && !manifest.screens.some((screen) => screen.flow === flow)) problems.push(`unknown catalog flow ${flow}`);
  if (stateKey && !manifest.screens.some((screen) => `${screen.flow}/${screen.id}` === stateKey)) problems.push(`unknown catalog state ${stateKey}`);
  if (flow && stateKey && !stateKey.startsWith(`${flow}/`)) problems.push(`catalog state ${stateKey} is outside flow ${flow}`);
  if (problems.length) return { problems, screens: 0, matched: [] };
  const scenarios = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };
  const captures = manifest.screens.filter((screen) => (!flow || screen.flow === flow) && (!stateKey || `${screen.flow}/${screen.id}` === stateKey))
    .map((screen) => ({ flow: screen.flow, screen: screen.id, viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "normal" }));
  const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
  setCaptureBase(preview.env.REPFORGE_URL);
  let browser = await launchChromium();
  const matched = new Set(), matchedExceptions = new Set();
  try {
    for (let index = 0; index < captures.length; index++) {
      const capture = captures[index], key = screenKey(capture), isOnboarding = key.startsWith("onboarding-");
      let context;
      try {
        if (!scenarios[key]) throw new Error("missing production catalog scenario");
        const opened = await openPage(browser, manifest, capture,
          isOnboarding ? onboardingState(key, "en") : appState(key, "en"), { userAgent: APP_USER_AGENT[key] });
        context = opened.context;
        if (!isOnboarding) await dismissChrome(opened.page);
        await scenarios[key](opened.page);
        await settle(opened.page);
        const result = await opened.page.evaluate(inspectRoleCoverage, {
          key, components: inventory.components, exceptions: inventory.exceptions,
          progressCandidateSelectors: inventory.progressCandidateSelectors, allowProgressDebt,
        });
        problems.push(...result.problems);
        for (const id of result.matched) matched.add(id);
        for (const selector of result.matchedExceptions) matchedExceptions.add(selector);
      } catch (error) {
        problems.push(`${key}: scenario failed: ${error.stack || error.message}`);
      } finally { await context?.close(); }
      onProgress(index + 1, captures.length);
      if ((index + 1) % 25 === 0) { await browser.close(); browser = await launchChromium(); }
    }
  } finally { await browser.close(); preview.cleanup(); }
  if (!flow && !stateKey) for (const item of inventory.components) {
    if (!matched.has(item.id) && !item.sourceOnly) problems.push(`inventory selector never rendered: ${item.selector}`);
  }
  if (!flow && !stateKey) for (const item of inventory.exceptions) {
    if (!matchedExceptions.has(item.selector) && !item.sourceOnlyReason) problems.push(`inventory exception never rendered: ${item.selector}`);
  }
  return { problems, screens: captures.length, matched: [...matched], matchedExceptions: [...matchedExceptions] };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const manifest = loadManifest(), inventory = loadRoleInventory();
  const metadata = validateRoleInventory(inventory, manifest);
  const cssArgument = process.argv.indexOf("--css");
  const cssPath = cssArgument < 0 ? join(ROOT, "styles.css") : process.argv[cssArgument + 1];
  if (!cssPath) throw new Error("--css needs a path");
  const css = readFileSync(cssPath, "utf8");
  const debt = cssLiteralDebt(css, inventory.exceptions);
  console.log(`UI system: ${manifest.screens.length} live states, ${inventory.components.length} selectors, ${inventory.exceptions.length} exceptions; ${debt.length} CSS literal declarations remain for P4–P6.`);
  for (const item of debt.slice(0, 8)) console.log(`  debt ${item.line}: ${item.selector} { ${item.property}: ${item.value} }`);
  if (process.argv.includes("--strict-css") && debt.length) metadata.push(`${debt.length} unapproved CSS literals`);
  if (!process.argv.includes("--metadata")) {
    const flowArgument = process.argv.indexOf("--flow");
    const flow = flowArgument < 0 ? null : process.argv[flowArgument + 1];
    if (flowArgument >= 0 && !flow) throw new Error("--flow needs a manifest flow id");
    const stateArgument = process.argv.indexOf("--state");
    const stateKey = stateArgument < 0 ? null : process.argv[stateArgument + 1];
    if (stateArgument >= 0 && !stateKey) throw new Error("--state needs a manifest state key");
    const result = await auditCatalog({ allowProgressDebt: process.argv.includes("--allow-progress-debt"), flow, stateKey,
      onProgress: (done, total) => { if (done % 25 === 0 || done === total) console.log(`  rendered ${done}/${total}`); } });
    metadata.push(...result.problems);
  }
  const shown = process.argv.includes("--verbose") ? metadata : metadata.slice(0, 40);
  for (const error of shown) console.error(`FAIL: ${error}`);
  if (metadata.length > shown.length) console.error(`... ${metadata.length - shown.length} more failures`);
  if (metadata.length) process.exitCode = 1;
}
