import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

export function requiredBoundaryExceptionRequests(exceptions, key) {
  return exceptions
    .filter((item) => item.boundary === "required" && item.catalogStates.includes(key))
    .map((item) => ({ selector: item.selector, kind: "boundary" }));
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
  const recipeIds = new Set();
  for (const item of inventory.rootRecipeOwners || []) {
    if (!item.id || recipeIds.has(item.id) || !item.token?.startsWith("--") || !Array.isArray(item.selectors) || !item.selectors.length
      || !item.role || !item.rationale || !item.owner || !Array.isArray(item.catalogStates) || !item.catalogStates.length) {
      errors.push(`root recipe ${item.id || "?"} needs a unique id, token, selectors, semantic role, rationale, owner and catalog states`);
    }
    recipeIds.add(item.id);
    if (item.sourceOnly && !item.sourceOnlyReason) errors.push(`root recipe ${item.id} needs a reason for not rendering in canonical catalog states`);
    for (const key of item.catalogStates || []) if (!expected.has(key)) errors.push(`root recipe ${item.id} names stale catalog state ${key}`);
  }
  return errors;
}

/** Existing literals are migration debt until P6. An isolated bad artifact is an error in strict mode. */
export function cssLiteralDebt(css, exceptions = []) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => " ".repeat(comment.length));
  const debt = [];
  const namedColors = `
    aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
    cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
    darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
    darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
    firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
    hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
    lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray
    lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
    mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
    mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
    paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown
    royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
    springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen
  `.trim().split(/\s+/);
  const namedColor = new RegExp(`\\b(?:${namedColors.join("|")})\\b`, "i");
  const lengthUnits = "(?:px|rem|em|%|pt|pc|in|cm|mm|q|ch|ex|cap|ic|lh|rlh|"
    + "vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|lvw|lvh|lvi|lvb|dvw|dvh|dvi|dvb|"
    + "cqw|cqh|cqi|cqb|cqmin|cqmax)";
  const typeMeasure = new RegExp(`(?:^|[\\s,(])(?:-?\\d*\\.?\\d+)${lengthUnits}?(?=[\\s,)/]|$)`, "i");
  const localMeasure = new RegExp(`\\b\\d+(?:\\.\\d+)?${lengthUnits}\\b`, "i");
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
    const isFontWeight = property === "font-weight";
    const isRadius = property === "border-radius" || property.startsWith("border-") && property.endsWith("-radius");
    const isShadow = property === "box-shadow" || property === "text-shadow";
    const isColor = /^(?:color|background(?:-color)?|border(?:-(?:top|bottom|left|right))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(property);
    const isCustomProperty = property.startsWith("--");
    const isLocalRoleToken = property.startsWith("--") && /(?:font|radius|shadow|color|ink|bg|boundary|surface|accent|rule)/.test(property);
    if (!isType && !isFontWeight && !isRadius && !isShadow && !isColor && !isLocalRoleToken && !isCustomProperty) continue;
    let literal = false;
    if (isType) literal = typeMeasure.test(value)
      && !/^(?:var\([^)]*\)|inherit|initial|unset|revert|revert-layer|normal|0|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|larger|smaller)$/i.test(value);
    if (isFontWeight && selector !== "@font-face") {
      const number = Number(value);
      const supportedWeight = /^\d+(?:\.\d+)?$/.test(value) && [400, 500, 600].includes(number);
      const inheritedOrTokenized = /^(?:var\(--weight-(?:regular|medium|semibold)\)|inherit|initial|unset|revert|normal)$/i.test(value);
      literal = !supportedWeight && !inheritedOrTokenized;
    }
    if (isRadius) {
      const measures = [...value.matchAll(/(?:^|[\s,(])(-?\d*\.?\d+)(px|rem|em|%|pt|vh|vw|dvh|svh|lvh)?(?=[\s,)/]|$)/g)];
      literal = measures.some((measure) => Number(measure[1]) !== 0) && value !== "50%";
    }
    if (isShadow) literal = value !== "none" && !/^var\([^)]*\)$/.test(value);
    // Token names are not colours: var(--band-orange-bg) names a token, not the keyword orange.
    const colorValue = value.replace(/url\([^)]*\)/gi, " ").replace(/--[\w-]+/g, " ");
    const hasColorLiteral = /#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})\b/i.test(colorValue)
      || /\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color|device-cmyk)\s*\((?!\s*var\()/i.test(colorValue)
      || namedColor.test(colorValue);
    if (isColor || isCustomProperty) literal = hasColorLiteral;
    if (isLocalRoleToken) literal ||= /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color|device-cmyk)\s*\((?!\s*var\()|\b\d+(?:\.\d+)?(?:px|rem|em)\b/i.test(value)
      || localMeasure.test(value);
    if (!literal) continue;
    const line = css.slice(0, match.index).split("\n").length;
    if (exceptions.some((item) => item.selector === selector && item.cssLiterals?.some((literal) => literal.property === property && literal.value === value))) continue;
    debt.push({ selector, property, value, line });
  }
  return debt;
}

const OBSOLETE_CSS_ALIASES = ["--radius-legacy", "--radius", "--r", "--shadow", "--display", "--body", "--mono"];

/** Compatibility aliases are dead once their real consumers have moved. */
export function cssCompatibilityAliasDebt(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => " ".repeat(comment.length));
  const pattern = new RegExp(`(?<![\\w-])(?:${OBSOLETE_CSS_ALIASES.join("|")})(?![\\w-])`, "g");
  return [...clean.matchAll(pattern)].map((match) => ({
    alias: match[0],
    line: css.slice(0, match.index).split("\n").length,
  }));
}

const linear = (v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export function contrastRatio(a, b) {
  const lum = (rgb) => 0.2126 * linear(rgb[0] / 255) + 0.7152 * linear(rgb[1] / 255) + 0.0722 * linear(rgb[2] / 255);
  const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Components and exceptions that no rendered state matched. Only meaningful over the complete catalog. */
/**
 * Plan 064 shared components live in one marked section of styles.css. Each
 * component block declared there (the class before any __element or
 * --modifier) must be named by an inventory component selector, so a shared
 * component cannot ship before its role is reviewed, even while nothing
 * renders it. Returns the uncovered block names.
 */
export const SHARED_COMPONENTS_MARKER = "/* ---- Plan 064 shared components ----";
export function uninventoriedSharedComponents(css, inventory) {
  const start = css.indexOf(SHARED_COMPONENTS_MARKER);
  if (start < 0) return [];
  const rest = css.slice(start);
  const next = rest.slice(SHARED_COMPONENTS_MARKER.length).search(/\n\/\* ---- /);
  const region = (next < 0 ? rest : rest.slice(0, SHARED_COMPONENTS_MARKER.length + next)).replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = new Set();
  for (const [, selector] of region.matchAll(/([^{}]+)\{/g)) {
    if (selector.trim().startsWith("@")) continue;
    for (const [, name] of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) blocks.add(name.split(/__|--/)[0]);
  }
  const selectors = inventory.components.map((item) => item.selector);
  return [...blocks].filter((block) => !selectors.some((selector) => new RegExp(`\\.${block}(?![\\w-])|\\.${block}(?:__|--)`).test(selector)));
}

export function neverRenderedProblems(inventory, matched, matchedExceptions) {
  const problems = [];
  for (const item of inventory.components) {
    if (!matched.has(item.id) && !item.sourceOnly) problems.push(`inventory selector never rendered: ${item.selector}`);
  }
  for (const item of inventory.exceptions) {
    if (!matchedExceptions.has(item.selector) && !item.sourceOnlyReason) problems.push(`inventory exception never rendered: ${item.selector}`);
  }
  return problems;
}

/**
 * Stripe the render list across shards: render i belongs to shard (i mod n)+1.
 * The list is screen-major, so every shard sees every screen roughly equally
 * often and the union of all shards is exactly the unsharded list.
 */
export function shardCaptures(captures, shard) {
  if (!shard) return captures;
  if (!Number.isSafeInteger(shard.index) || !Number.isSafeInteger(shard.count)
    || shard.index < 1 || shard.index > shard.count || shard.count < 1) {
    throw new Error(`Invalid capture shard ${JSON.stringify(shard)}`);
  }
  if (captures.length < shard.count) {
    throw new Error(`Cannot distribute ${captures.length} capture(s) across ${shard.count} non-empty shards`);
  }
  return captures.filter((_, index) => index % shard.count === shard.index - 1);
}

export const SHARD_REPORT = "ui-system-shard.json";

/** Union the per-shard reports of one complete sweep and apply the catalog-wide rules. */
export function mergeShardReports(reports, inventory, { expectedShardCount, expectedScreenCount, expectedCaptureKeysByShard } = {}) {
  const problems = [];
  if (!Array.isArray(reports)) return { problems: ["ui-system shard reports must be an array"], shards: 0, screens: 0 };
  if (!Number.isSafeInteger(expectedShardCount) || expectedShardCount < 1) problems.push("expected shard count must be a positive integer");
  if (!Number.isSafeInteger(expectedScreenCount) || expectedScreenCount < 1) problems.push("expected screen count must be a positive integer");
  if (expectedCaptureKeysByShard !== undefined
    && (!Array.isArray(expectedCaptureKeysByShard) || expectedCaptureKeysByShard.length !== expectedShardCount
      || expectedCaptureKeysByShard.some((keys) => !Array.isArray(keys) || keys.some((key) => typeof key !== "string")
        || new Set(keys).size !== keys.length))) {
    problems.push("expected per-shard capture keys must be complete arrays of unique strings");
  }
  if (Number.isSafeInteger(expectedShardCount) && reports.length !== expectedShardCount) {
    problems.push(`expected ${expectedShardCount} reports, got ${reports.length}`);
  }
  const counts = new Set();
  const indices = [];
  const matched = new Set();
  const matchedExceptions = new Set();
  const componentIds = new Set((inventory.components || []).map((item) => item.id));
  const exceptionSelectors = new Set((inventory.exceptions || []).map((item) => item.selector));
  const captureKeys = new Set();
  const failed = [];
  let screens = 0;
  for (const [row, report] of reports.entries()) {
    if (!report || typeof report !== "object" || Array.isArray(report)) {
      problems.push(`report ${row + 1} must be an object`);
      continue;
    }
    if (report.schemaVersion !== 2) problems.push(`report ${row + 1} has unsupported schemaVersion ${JSON.stringify(report.schemaVersion)}`);
    const shard = report.shard;
    const validShard = shard && Number.isSafeInteger(shard.index) && Number.isSafeInteger(shard.count)
      && shard.index >= 1 && shard.index <= shard.count && shard.count >= 1;
    if (!validShard) {
      problems.push(`report ${row + 1} has an invalid shard identity`);
    } else {
      counts.add(shard.count);
      indices.push(shard.index);
      if (Number.isSafeInteger(expectedShardCount) && shard.count !== expectedShardCount) {
        problems.push(`shard ${shard.index} declared ${shard.count} shards, expected ${expectedShardCount}`);
      }
    }
    if (!Number.isSafeInteger(report.screens) || report.screens < 0) {
      problems.push(`report ${row + 1} has an invalid screen count`);
    } else {
      screens += report.screens;
    }
    if (!Array.isArray(report.captureKeys) || report.captureKeys.some((value) => typeof value !== "string")
      || new Set(report.captureKeys).size !== report.captureKeys.length) {
      problems.push(`report ${row + 1} captureKeys must be an array of unique strings`);
    } else {
      if (Number.isSafeInteger(report.screens) && report.captureKeys.length !== report.screens) {
        problems.push(`report ${row + 1} lists ${report.captureKeys.length} capture key(s), but reports ${report.screens} rendered states`);
      }
      for (const key of report.captureKeys) {
        if (captureKeys.has(key)) problems.push(`report ${row + 1} duplicates capture key ${key}`);
        captureKeys.add(key);
      }
      if (validShard && Array.isArray(expectedCaptureKeysByShard)
        && JSON.stringify(report.captureKeys) !== JSON.stringify(expectedCaptureKeysByShard[shard.index - 1])) {
        problems.push(`report ${row + 1} capture keys do not match shard ${shard.index}/${shard.count}`);
      }
    }
    if (!Array.isArray(report.matched) || report.matched.some((value) => typeof value !== "string")
      || new Set(report.matched).size !== report.matched.length) {
      problems.push(`report ${row + 1} matched must be an array of unique strings`);
    } else {
      for (const id of report.matched) {
        if (!componentIds.has(id)) problems.push(`report ${row + 1} names unknown component id ${id}`);
        else matched.add(id);
      }
    }
    if (!Array.isArray(report.matchedExceptions) || report.matchedExceptions.some((value) => typeof value !== "string")
      || new Set(report.matchedExceptions).size !== report.matchedExceptions.length) {
      problems.push(`report ${row + 1} matchedExceptions must be an array of unique strings`);
    } else {
      for (const selector of report.matchedExceptions) {
        if (!exceptionSelectors.has(selector)) problems.push(`report ${row + 1} names unknown exception selector ${selector}`);
        else matchedExceptions.add(selector);
      }
    }
    if (!Number.isSafeInteger(report.problems) || report.problems < 0) {
      problems.push(`report ${row + 1} has an invalid problems count`);
    } else if (report.problems > 0 && validShard) {
      failed.push(`${shard.index}/${shard.count}`);
    }
  }
  if (counts.size > 1) problems.push(`shard reports disagree on shard count: ${[...counts].join(", ")}`);
  if (Number.isSafeInteger(expectedShardCount) && expectedShardCount > 0) {
    for (let index = 1; index <= expectedShardCount; index++) {
      const seen = indices.filter((value) => value === index).length;
      if (seen !== 1) problems.push(`shard ${index}/${expectedShardCount} reported ${seen} time(s)`);
    }
  }
  if (Number.isSafeInteger(expectedScreenCount) && screens !== expectedScreenCount) {
    problems.push(`reports rendered ${screens} catalog states, expected ${expectedScreenCount}`);
  }
  if (Array.isArray(expectedCaptureKeysByShard) && expectedCaptureKeysByShard.length === expectedShardCount) {
    const expectedKeys = expectedCaptureKeysByShard.flat();
    const expectedSet = new Set(expectedKeys);
    const missing = expectedKeys.filter((key) => !captureKeys.has(key));
    const unexpected = [...captureKeys].filter((key) => !expectedSet.has(key));
    if (expectedSet.size !== expectedKeys.length) problems.push("expected per-shard capture keys overlap");
    if (missing.length) problems.push(`reports are missing ${missing.length} catalog capture key(s), including ${missing.slice(0, 3).join(", ")}`);
    if (unexpected.length) problems.push(`reports contain ${unexpected.length} unknown catalog capture key(s), including ${unexpected.slice(0, 3).join(", ")}`);
  }
  if (failed.length) problems.push(`shard(s) ${failed.join(", ")} reported role problems; see their own logs`);
  if (!problems.length) problems.push(...neverRenderedProblems(inventory, matched, matchedExceptions));
  return { problems, shards: reports.length, screens };
}

export function findShardReports(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === SHARD_REPORT) found.push(JSON.parse(readFileSync(path, "utf8")));
    }
  };
  if (existsSync(root)) walk(root);
  return found;
}
