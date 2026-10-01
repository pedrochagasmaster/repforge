#!/usr/bin/env node
/** Live Plan 058 role inventory. Existing CSS literals are debt until P6. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ROOT, captureKey, loadManifest, screenKey } from "./ui-screens/manifest.mjs";
import { parseShard } from "../test/suites.mjs";
import { loadRoleInventory, validateRoleInventory, cssLiteralDebt, cssCompatibilityAliasDebt, requiredBoundaryExceptionRequests, SHARD_REPORT, neverRenderedProblems, shardCaptures, uninventoriedSharedComponents } from "./ui-system-core.mjs";
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState } from "./ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS, onboardingState } from "./ui-screens/screens-onboarding.mjs";
import { setCaptureBase, launchChromium, openPage, dismissChrome, settle } from "./ui-screens/session.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
import { measureRenderedRoles, renderedRoleProblems } from "./ui-system-rendered.mjs";
import { join, resolve } from "node:path";

export function inspectRoleCoverage({ key, components, exceptions, progressCandidateSelectors, allowProgressDebt = false }) {
  const progressSelectors = [...new Set([...progressCandidateSelectors, "progress", "[role='progressbar']"])];
  const visible = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    for (let current = node; current; current = current.parentElement) {
      if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
    }
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

export async function auditFocusRoles(page, { key, components, pixels }) {
  const targets = await page.evaluate((items) => {
    const visible = (node) => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      for (let current = node; current; current = current.parentElement) {
        if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
      }
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
        && !node.closest("[inert],.visually-hidden");
    };
    const uniqueSelector = (node) => {
      const parts = [];
      for (let current = node; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentElement) {
        if (current.id) {
          const idSelector = `#${CSS.escape(current.id)}`;
          if (document.querySelectorAll(idSelector).length === 1) { parts.unshift(idSelector); break; }
        }
        if (!current.parentElement) { parts.unshift(current.localName); break; }
        const siblings = [...current.parentElement?.children || []].filter((item) => item.localName === current.localName);
        parts.unshift(`${current.localName}:nth-of-type(${siblings.indexOf(current) + 1})`);
      }
      return parts.join(" > ");
    };
    const result = new Map();
    for (const item of items) {
      if (!item.roles?.control || !item.states?.includes("focus-visible")) continue;
      let nodes;
      try { nodes = [...document.querySelectorAll(item.selector)]; } catch { continue; }
      for (const node of nodes) {
        if (!visible(node) || node.matches(":disabled,[aria-disabled='true'],.is-disabled")) continue;
        const selector = uniqueSelector(node);
        result.set(selector, { selector, owner: item.selector, label: node.id ? `#${node.id}` : node.localName });
      }
    }
    return [...result.values()];
  }, components);
  const problems = [];
  const measurements = { total: 0, pass: 0, fail: 0, unsupported: 0, missing: 0, exempt: 0 };
  if (!targets.length) return { problems, measurements };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const resolvedTargets = await Promise.all(targets.map(async (target) => ({
      target,
      ...await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: target.selector }),
    })));
    const focusTargets = [];
    for (const { target, nodeId } of resolvedTargets) {
      if (!nodeId) {
        const missing = [{ selector: `${target.owner}:${target.label}`, kind: "focus", status: "missing" }];
        measurements.missing += 1;
        measurements.total += 1;
        problems.push(...renderedRoleProblems(`${key} [focus-visible]`, missing));
      } else {
        focusTargets.push({ target, nodeId });
      }
    }
    if (focusTargets.length) {
      await Promise.all(focusTargets.map(({ nodeId }) => session.send("CSS.forcePseudoState", {
        nodeId, forcedPseudoClasses: ["focus-visible"],
      })));
      let rendered;
      try {
        rendered = await page.evaluate(measureRenderedRoles, {
          requests: focusTargets.map(({ target }) => ({ selector: target.selector, kind: "focus" })), pixels,
        });
      } finally {
        await Promise.allSettled(focusTargets.map(({ nodeId }) => session.send("CSS.forcePseudoState", {
          nodeId, forcedPseudoClasses: [],
        })));
      }
      for (const item of rendered) measurements[item.status] = (measurements[item.status] || 0) + 1;
      measurements.total += rendered.length;
      problems.push(...renderedRoleProblems(`${key} [focus-visible]`, rendered));
    }
  } finally {
    await session.detach();
  }
  return { problems, measurements };
}

export async function auditCatalog({ allowProgressDebt = false, flow = null, stateKey = null, theme = null, locale = null, shard = null, onProgress = () => {} } = {}) {
  const manifest = loadManifest();
  const inventory = loadRoleInventory();
  const problems = validateRoleInventory(inventory, manifest);
  if (problems.length) return { problems, screens: 0, captureKeys: [], matched: [] };
  if (flow && !manifest.screens.some((screen) => screen.flow === flow)) problems.push(`unknown catalog flow ${flow}`);
  if (stateKey && !manifest.screens.some((screen) => `${screen.flow}/${screen.id}` === stateKey)) problems.push(`unknown catalog state ${stateKey}`);
  if (flow && stateKey && !stateKey.startsWith(`${flow}/`)) problems.push(`catalog state ${stateKey} is outside flow ${flow}`);
  const locales = locale ? [locale] : Object.keys(manifest.locales);
  const themes = theme ? [theme] : manifest.themes;
  for (const value of locales) if (!manifest.locales[value]) problems.push(`unknown catalog locale ${value}`);
  for (const value of themes) if (!manifest.themes.includes(value) || !["light", "dark"].includes(value)) problems.push(`unknown catalog theme ${value}`);
  if (problems.length) return { problems, screens: 0, captureKeys: [], matched: [] };
  const scenarios = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };
  const captures = shardCaptures(manifest.screens.filter((screen) => (!flow || screen.flow === flow) && (!stateKey || `${screen.flow}/${screen.id}` === stateKey))
    .flatMap((screen) => themes.flatMap((captureTheme) => locales.map((captureLocale) => ({
      flow: screen.flow, screen: screen.id, viewport: "phone-390", theme: captureTheme, locale: captureLocale,
      text: "normal", motion: "normal",
    })))), shard);
  const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
  setCaptureBase(preview.env.REPFORGE_URL);
  let browser = await launchChromium();
  const matched = new Set(), matchedExceptions = new Set();
  const measurements = { total: 0, pass: 0, fail: 0, unsupported: 0, missing: 0, exempt: 0 };
  try {
    for (let index = 0; index < captures.length; index++) {
      const capture = captures[index], key = screenKey(capture), isOnboarding = key.startsWith("onboarding-");
      let context;
      try {
        if (!scenarios[key]) throw new Error("missing production catalog scenario");
        const opened = await openPage(browser, manifest, capture,
          isOnboarding ? onboardingState(key, capture.locale) : appState(key, capture.locale), { userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key] });
        context = opened.context;
        if (!isOnboarding) await dismissChrome(opened.page);
        await scenarios[key](opened.page);
        await settle(opened.page);
        const renderedImage = await opened.page.screenshot({ animations: "disabled" });
        const result = await opened.page.evaluate(inspectRoleCoverage, {
          key, components: inventory.components, exceptions: inventory.exceptions,
          progressCandidateSelectors: inventory.progressCandidateSelectors, allowProgressDebt,
        });
        problems.push(...result.problems);
        for (const id of result.matched) matched.add(id);
        for (const selector of result.matchedExceptions) matchedExceptions.add(selector);
        const pixels = renderedImage.toString("base64");
        const focus = await auditFocusRoles(opened.page, { key: `${key} [${capture.locale}/${capture.theme}]`, components: inventory.components, pixels });
        problems.push(...focus.problems);
        for (const [status, count] of Object.entries(focus.measurements)) measurements[status] = (measurements[status] || 0) + count;
        const rendered = await opened.page.evaluate(measureRenderedRoles, { components: inventory.components, pixels });
        for (const item of rendered) measurements[item.status] = (measurements[item.status] || 0) + 1;
        measurements.total += rendered.length;
        problems.push(...renderedRoleProblems(`${key} [${capture.locale}/${capture.theme}]`, rendered));
        const exceptionBoundaries = requiredBoundaryExceptionRequests(inventory.exceptions, key);
        if (exceptionBoundaries.length) {
          const renderedExceptions = await opened.page.evaluate(measureRenderedRoles, { requests: exceptionBoundaries, pixels });
          for (const item of renderedExceptions) measurements[item.status] = (measurements[item.status] || 0) + 1;
          measurements.total += renderedExceptions.length;
          problems.push(...renderedRoleProblems(`${key} [${capture.locale}/${capture.theme}]`, renderedExceptions));
        }
      } catch (error) {
        problems.push(`${key}: scenario failed: ${error.stack || error.message}`);
      } finally { await context?.close(); }
      onProgress(index + 1, captures.length);
      if ((index + 1) % 25 === 0) { await browser.close(); browser = await launchChromium(); }
    }
  } finally { await browser.close(); preview.cleanup(); }
  // A partial sweep cannot know what the other shards rendered; `ci-plan.mjs merge-ui-system` applies this rule over all of them.
  if (!flow && !stateKey && !shard) problems.push(...neverRenderedProblems(inventory, matched, matchedExceptions));
  return { problems, screens: captures.length, captureKeys: captures.map(captureKey), matched: [...matched], matchedExceptions: [...matchedExceptions], measurements };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const manifest = loadManifest(), inventory = loadRoleInventory();
  const metadata = validateRoleInventory(inventory, manifest);
  const args = process.argv.slice(2), requestedCss = [];

  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--css") continue;
    const path = args[index + 1];
    if (!path || path.startsWith("--")) throw new Error("--css needs a path");
    requestedCss.push(path);
    index++;
  }
  const cssPaths = requestedCss.length ? requestedCss : ["styles.css", "motion-polish.css"];
  const cssFiles = cssPaths.map((path) => ({ path, css: readFileSync(resolve(ROOT, path), "utf8") }));
  const debt = cssFiles.flatMap(({ path, css }) => cssLiteralDebt(css, inventory.exceptions).map((item) => ({ ...item, path })));
  const aliases = cssFiles.flatMap(({ path, css }) => cssCompatibilityAliasDebt(css).map((item) => ({ ...item, path })));
  console.log(`UI system: ${manifest.screens.length} live states, ${inventory.components.length} selectors, ${inventory.exceptions.length} exceptions; ${debt.length} CSS literal declarations and ${aliases.length} obsolete alias references remain for P4–P6.`);
  for (const item of debt.slice(0, 8)) console.log(`  debt ${item.path}:${item.line}: ${item.selector} { ${item.property}: ${item.value} }`);
  for (const item of aliases.slice(0, 8)) console.log(`  alias ${item.path}:${item.line}: ${item.alias}`);
  if (process.argv.includes("--strict-css") && debt.length) metadata.push(`${debt.length} unapproved CSS literals`);
  for (const { path, css } of cssFiles) {
    for (const block of uninventoriedSharedComponents(css, inventory)) metadata.push(`${path}: shared component .${block} has no inventory row`);
  }
  if (process.argv.includes("--strict-css") && aliases.length) metadata.push(`${aliases.length} obsolete CSS alias references`);
  if (!process.argv.includes("--metadata")) {
    const flowArgument = process.argv.indexOf("--flow");
    const flow = flowArgument < 0 ? null : process.argv[flowArgument + 1];
    if (flowArgument >= 0 && !flow) throw new Error("--flow needs a manifest flow id");
    const stateArgument = process.argv.indexOf("--state");
    const stateKey = stateArgument < 0 ? null : process.argv[stateArgument + 1];
    if (stateArgument >= 0 && !stateKey) throw new Error("--state needs a manifest state key");
    const themeArgument = process.argv.indexOf("--theme");
    const theme = themeArgument < 0 ? null : process.argv[themeArgument + 1];
    if (themeArgument >= 0 && !theme) throw new Error("--theme needs light or dark");
    const localeArgument = process.argv.indexOf("--locale");
    const locale = localeArgument < 0 ? null : process.argv[localeArgument + 1];
    if (localeArgument >= 0 && !locale) throw new Error("--locale needs a manifest locale");
    const shardArgument = process.argv.indexOf("--shard");
    const shard = shardArgument < 0 ? null : parseShard(process.argv[shardArgument + 1]);
    if (shard && (flow || stateKey || theme || locale)) throw new Error("--shard partitions the complete catalog; drop --flow/--state/--theme/--locale");
    const result = await auditCatalog({ allowProgressDebt: process.argv.includes("--allow-progress-debt"), flow, stateKey, theme, locale, shard,
      onProgress: (done, total) => { if (done % 25 === 0 || done === total) console.log(`  rendered ${done}/${total}`); } });
    console.log(`Rendered-role checks: ${result.measurements?.total || 0}; passes ${result.measurements?.pass || 0}; failures ${result.measurements?.fail || 0}; unsupported ${result.measurements?.unsupported || 0}; missing ${result.measurements?.missing || 0}; exempt ${result.measurements?.exempt || 0}.`);
    metadata.push(...result.problems);
    if (shard) {
      const reportDir = resolve(ROOT, process.env.REPFORGE_ARTIFACT_DIR || ".ci-results");
      mkdirSync(reportDir, { recursive: true });
      writeFileSync(join(reportDir, SHARD_REPORT), JSON.stringify({ schemaVersion: 2, shard, screens: result.screens, captureKeys: result.captureKeys,
        matched: result.matched, matchedExceptions: result.matchedExceptions, problems: result.problems.length }, null, 2) + "\n");
      console.log(`Shard ${shard.index}/${shard.count}: ${result.screens} rendered states; report in ${join(reportDir, SHARD_REPORT)}`);
    }
  }
  const shown = process.argv.includes("--verbose") ? metadata : metadata.slice(0, 40);
  for (const error of shown) console.error(`FAIL: ${error}`);
  if (metadata.length > shown.length) console.error(`... ${metadata.length - shown.length} more failures`);
  if (metadata.length) process.exitCode = 1;
}
