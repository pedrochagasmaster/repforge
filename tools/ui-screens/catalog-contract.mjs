/**
 * Browser-side evidence and Node-side validation for the catalog's bounded
 * correctness contract. The collector deliberately measures rendered DOM,
 * rather than inferring layout or copy from templates.
 */
export const CATALOG_CONTRACT_VERSION = 1;

export const INTERNAL_COPY_PREFIXES = Object.freeze([
  "day_empty:",
  "exercise_invalid:",
  "progression_incompatible:",
  "program_exercises_required",
]);

/** Runs in the browser after a catalog scenario has settled. */
export function collectCatalogEvidence(config = {}) {
  const layoutSelector = [
    "button", "input", "select", "textarea", "label", "legend",
    "h1", "h2", "h3", "h4", "h5", "h6", "table", "fieldset",
    "[data-catalog-layout]",
  ].join(",");
  const stableLocator = (element) => {
    if (element.id) return `#${element.id}`;
    const role = element.getAttribute("data-role");
    if (role) return `[data-role="${role}"]`;
    return element.tagName.toLowerCase();
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
      && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
      && !element.closest("[aria-hidden=\"true\"], [inert], .visually-hidden");
  };
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  const overflow = [];
  for (const element of document.querySelectorAll(layoutSelector)) {
    if (!visible(element) || element.clientWidth < 1) continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      const style = getComputedStyle(element);
      overflow.push({
        locator: stableLocator(element), tag: element.tagName.toLowerCase(),
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        overflowX: style.overflowX, allowed: element.getAttribute("data-allow-horizontal-scroll"),
        box: rect(element),
      });
    }
  }
  const scrollers = (config.intentionalScrollers || []).map((allowance) => {
    const element = document.querySelector(allowance.locator);
    if (!element) return { ...allowance, missing: true };
    const children = [...element.children].filter(visible).map((child) => rect(child));
    const box = rect(element);
    return {
      ...allowance,
      missing: false,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      tabIndex: element.tabIndex,
      touchAction: getComputedStyle(element).touchAction,
      marker: element.getAttribute("data-allow-horizontal-scroll"),
      cue: element.getAttribute("data-horizontal-scroll-cue"),
      box,
      hasPartialChild: children.some((child) => child.left < box.right - 1 && child.right > box.right + 1),
    };
  });
  const nonOverlap = (config.nonOverlapGroups || []).map((group) => {
    const container = document.querySelector(group.locator);
    if (!container) return { ...group, missing: true, pairs: [] };
    const elements = [...container.querySelectorAll(group.members)].filter(visible);
    const pairs = [];
    for (let index = 0; index < elements.length; index++) for (let next = index + 1; next < elements.length; next++) {
      const a = rect(elements[index]), b = rect(elements[next]);
      const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      if (intersects) pairs.push({ a: stableLocator(elements[index]), b: stableLocator(elements[next]), aBox: a, bBox: b });
    }
    return { ...group, missing: false, pairs };
  });
  const text = [document.body.innerText || ""];
  for (const element of document.querySelectorAll("[aria-label]")) if (visible(element)) text.push(element.getAttribute("aria-label") || "");
  return {
    document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    text, overflow, scrollers, nonOverlap,
  };
}

const rawKey = /\b[a-z][\w-]*(?:\.[a-z][\w-]*){1,}\b/g;
const unresolved = /\b(?:undefined|null|\[object Object\])\b|\{[A-Za-z][\w.-]*\}/;

export function validateCatalogMetadata(manifest) {
  const errors = [];
  const checks = manifest.catalogChecks;
  if (!checks || checks.version !== CATALOG_CONTRACT_VERSION) return ["catalogChecks must declare the current contract version"];
  const knownScreens = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  for (const key of ["intentionalScrollers", "nonOverlapGroups", "renderedCopyAllowances"]) {
    if (!Array.isArray(checks[key])) errors.push(`catalogChecks.${key} must be an array`);
  }
  const seen = new Set();
  for (const item of checks.intentionalScrollers || []) {
    const key = `${item.screen}|${item.locator}`;
    if (!knownScreens.has(item.screen)) errors.push(`intentional scroller names unknown screen ${item.screen}`);
    if (!item.locator?.startsWith("#") || /[\s,>]/.test(item.locator)) errors.push(`intentional scroller ${key} needs one stable ID locator`);
    if (item.axis !== "x" || !item.reason || !item.owner) errors.push(`intentional scroller ${key} needs axis, reason, and owner`);
    if (seen.has(key)) errors.push(`duplicate intentional scroller ${key}`);
    seen.add(key);
  }
  for (const item of checks.nonOverlapGroups || []) {
    if (!knownScreens.has(item.screen) || !item.locator?.startsWith("#") || !item.members || !item.reason || !item.owner) {
      errors.push(`non-overlap group needs a known screen, stable locator, members, reason, and owner`);
    }
  }
  return errors;
}

export function configForCapture(manifest, capture) {
  const screen = `${capture.flow}/${capture.screen}`;
  const checks = manifest.catalogChecks || {};
  return {
    screen,
    intentionalScrollers: (checks.intentionalScrollers || []).filter((item) => item.screen === screen),
    nonOverlapGroups: (checks.nonOverlapGroups || []).filter((item) => item.screen === screen),
    renderedCopyAllowances: (checks.renderedCopyAllowances || []).filter((item) => item.screen === screen),
  };
}

export function validateCatalogEvidence(evidence, config, { knownKeyNamespaces = [] } = {}) {
  const failures = [];
  const excerpt = (text) => String(text).replace(/\s+/g, " ").slice(0, 240);
  if (evidence.document.scrollWidth > evidence.document.clientWidth + 1) {
    failures.push(`document overflow: client=${evidence.document.clientWidth} scroll=${evidence.document.scrollWidth}`);
  }
  for (const item of evidence.overflow) {
    if (item.allowed !== "x") failures.push(`clipped ${item.tag} ${item.locator}: client=${item.clientWidth} scroll=${item.scrollWidth} box=${JSON.stringify(item.box)}`);
  }
  for (const scroller of evidence.scrollers) {
    if (scroller.missing) failures.push(`intentional scroller missing: ${scroller.locator}`);
    else if (scroller.scrollWidth > scroller.clientWidth + 1 && (scroller.marker !== "x" || scroller.tabIndex < 0 || !scroller.cue || !scroller.hasPartialChild)) {
      failures.push(`invalid intentional scroller ${scroller.locator}: client=${scroller.clientWidth} scroll=${scroller.scrollWidth} marker=${scroller.marker} tabIndex=${scroller.tabIndex} cue=${scroller.cue} partial=${scroller.hasPartialChild}`);
    }
  }
  for (const group of evidence.nonOverlap) {
    if (group.missing) failures.push(`non-overlap group missing: ${group.locator}`);
    for (const pair of group.pairs) failures.push(`overlap ${group.locator}: ${pair.a} ${JSON.stringify(pair.aBox)} intersects ${pair.b} ${JSON.stringify(pair.bBox)}`);
  }
  for (const source of evidence.text) {
    for (const prefix of INTERNAL_COPY_PREFIXES) if (source.includes(prefix)) failures.push(`raw internal copy (${prefix}): ${excerpt(source)}`);
    if (unresolved.test(source)) failures.push(`unresolved rendered copy: ${excerpt(source)}`);
    for (const token of source.match(rawKey) || []) {
      if (knownKeyNamespaces.some((namespace) => token === namespace || token.startsWith(`${namespace}.`))) {
        failures.push(`raw translation key ${token}: ${excerpt(source)}`);
      }
    }
  }
  return failures;
}
