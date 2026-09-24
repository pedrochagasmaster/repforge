import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./ui-screens/manifest.mjs";

export const ROLE_FAMILIES = Object.freeze({
  elevation: ["flat", "selected", "floating", "modal", "persistent-action"],
  control: ["primary", "secondary", "quiet-navigation", "destructive", "disclosure", "selection", "adjustment", "field"],
  progress: ["block", "week", "exercise-set", "task"],
  boundary: ["decorative", "required"],
  typography: ["label", "caption", "body-small", "body", "control", "subtitle", "metric", "section-title", "feature-title", "focal-data", "title", "display", "training-data"],
});

export function loadRoleInventory(path = join(ROOT, "tools", "ui-role-inventory.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateRoleInventory(inventory, manifest) {
  const errors = [];
  const expected = new Set(manifest.screens.map(({ flow, id }) => `${flow}/${id}`));
  const actual = new Set(Object.keys(inventory.catalogStates || {}));
  if (inventory.schemaVersion !== 1) errors.push("inventory schemaVersion must be 1");
  for (const key of expected) if (!actual.has(key)) errors.push(`unmapped catalog state ${key}`);
  for (const key of actual) if (!expected.has(key)) errors.push(`stale catalog state ${key}`);
  for (const [key, state] of Object.entries(inventory.catalogStates || {})) {
    if (!state.owner || state.content !== "flat" || !state.scenario) errors.push(`${key} needs owner, flat page role and production scenario`);
  }
  const selectors = new Set();
  for (const item of inventory.components || []) {
    if (!item.selector || typeof item.selector !== "string" || item.selector === "*" || item.selector.includes("**")) {
      errors.push(`component ${item.id || "?"} needs a concrete selector`);
      continue;
    }
    if (selectors.has(item.selector)) errors.push(`ambiguous component selector ${item.selector}`);
    selectors.add(item.selector);
    if (!item.roles || !Object.keys(item.roles).length) errors.push(`${item.selector} needs semantic roles`);
    for (const [family, role] of Object.entries(item.roles || {})) {
      for (const value of Array.isArray(role) ? role : [role]) {
        if (!ROLE_FAMILIES[family]?.includes(value)) errors.push(`unknown ${family} role ${value} at ${item.selector}`);
      }
    }
    if (item.roles?.progress) {
      const dimensions = Array.isArray(item.roles.progress) ? item.roles.progress : [item.roles.progress];
      if (!item.progressScopes || !Object.keys(item.progressScopes).length) errors.push(`${item.selector} needs exact progress scopes`);
      for (const [scope, dimension] of Object.entries(item.progressScopes || {})) {
        if (!scope || !dimensions.includes(dimension)) errors.push(`${item.selector} has invalid progress scope ${scope}/${dimension}`);
      }
    }
    if (!item.owner || !item.rationale) errors.push(`${item.selector} needs owner and rationale`);
    if (item.sourceOnly && !item.sourceOnlyReason) errors.push(`${item.selector} needs a reason for not rendering in canonical catalog states`);
    if (!Array.isArray(item.states) || !item.states.length) errors.push(`${item.selector} needs interaction states`);
    if (item.roles?.control) {
      for (const state of ["default", "focus-visible"]) if (!item.states?.includes(state)) errors.push(`${item.selector} needs shared ${state} control state`);
      if (!item.states?.includes("disabled") && !item.neverDisabledReason) errors.push(`${item.selector} needs disabled state or an explicit non-applicability reason`);
    }
    if (!Array.isArray(item.catalogStates) || !item.catalogStates.length) errors.push(`${item.selector} needs affected catalog states`);
    for (const key of item.catalogStates || []) if (!expected.has(key)) errors.push(`${item.selector} names stale catalog state ${key}`);
  }
  const exceptionSelectors = new Set();
  for (const item of inventory.exceptions || []) {
    if (!item.selector || !/^[.#]/.test(item.selector) || item.selector.includes("*") || item.selector.includes(",") || !item.role || item.role === "*" || !item.rationale || !item.owner || !Array.isArray(item.catalogStates) || !item.catalogStates.length) {
      errors.push(`exception ${item.selector || "?"} needs exact selector, role, rationale, owner and catalog states`);
    }
    if (exceptionSelectors.has(item.selector)) errors.push(`duplicate exception selector ${item.selector}`);
    exceptionSelectors.add(item.selector);
    for (const key of item.catalogStates || []) if (!expected.has(key)) errors.push(`exception ${item.selector} names stale catalog state ${key}`);
    for (const literal of item.cssLiterals || []) {
      if (!literal.property || !literal.value) errors.push(`exception ${item.selector} has an incomplete CSS literal`);
    }
  }
  for (const item of inventory.contextualVariants || []) {
    if (!item.id || !item.selector || !item.role || !item.rationale || !item.owner || !Array.isArray(item.catalogStates) || !item.catalogStates.length) {
      errors.push(`contextual variant ${item.id || "?"} needs selector, role, rationale, owner and catalog states`);
    }
    for (const key of item.catalogStates || []) if (!expected.has(key)) errors.push(`contextual variant ${item.id} names stale catalog state ${key}`);
  }
  return errors;
}

/** Existing literals are migration debt until P6. An isolated bad artifact is an error in strict mode. */
export function cssLiteralDebt(css, exceptions = []) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => " ".repeat(comment.length));
  const debt = [];
  const declaration = /([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g;
  for (const match of clean.matchAll(declaration)) {
    const property = match[1].toLowerCase();
    const value = match[2].trim();
    const brace = clean.lastIndexOf("{", match.index);
    const prior = clean.lastIndexOf("}", brace);
    const selector = clean.slice(prior + 1, brace).trim().replace(/\s+/g, " ");
    const tokenDefinition = selector === ":root" || selector === ':root[data-theme="dark"]';
    if (property.startsWith("--") && tokenDefinition) continue;
    const isType = property === "font-size";
    const isRadius = property === "border-radius" || property.startsWith("border-") && property.endsWith("-radius");
    const isShadow = property === "box-shadow" || property === "text-shadow";
    const isColor = /^(?:color|background(?:-color)?|border(?:-(?:top|bottom|left|right))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(property);
    const isLocalRoleToken = property.startsWith("--") && /(?:font|radius|shadow|color|ink|bg|boundary|surface|accent|rule)/.test(property);
    if (!isType && !isRadius && !isShadow && !isColor && !isLocalRoleToken) continue;
    let literal = false;
    if (isType || isRadius) literal = /(?:^|[\s,(])(?:-?\d*\.?\d+)(?:px|rem|em|%|pt|vh|vw|dvh|svh|lvh)?(?=[\s,)/]|$)/.test(value)
      && !/^(?:var\([^)]*\)|inherit|initial|unset|revert|normal|0)$/.test(value)
      && !(isRadius && value === "50%");
    if (isShadow) literal = value !== "none" && !/^var\([^)]*\)$/.test(value);
    if (isColor) literal = !/url\(/i.test(value) && (/#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})\b/i.test(value)
      || /\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch)\s*\((?!\s*var\()/i.test(value)
      || /\b(?:black|white|red|orange|green|blue|gray|grey)\b/i.test(value));
    if (isLocalRoleToken) literal = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch)\s*\((?!\s*var\()|\b\d+(?:\.\d+)?(?:px|rem|em)\b/i.test(value);
    if (!literal) continue;
    const line = css.slice(0, match.index).split("\n").length;
    if (exceptions.some((item) => item.selector === selector && item.cssLiterals?.some((literal) => literal.property === property && literal.value === value))) continue;
    debt.push({ selector, property, value, line });
  }
  return debt;
}

const linear = (v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export function contrastRatio(a, b) {
  const lum = (rgb) => 0.2126 * linear(rgb[0] / 255) + 0.7152 * linear(rgb[1] / 255) + 0.0722 * linear(rgb[2] / 255);
  const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
