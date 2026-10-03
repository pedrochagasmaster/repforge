#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ROOT, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { loadRoleInventory, validateRoleInventory, cssLiteralDebt, cssCompatibilityAliasDebt, contrastRatio, requiredBoundaryExceptionRequests, uninventoriedSharedComponents, SHARED_COMPONENTS_MARKER } from "../tools/ui-system-core.mjs";
import { measureClampedHeadings, measureRenderedRoles, renderedRoleProblems } from "../tools/ui-system-rendered.mjs";
import { auditFocusRoles, inspectRoleCoverage } from "../tools/check-ui-system.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
import { onboardingState, ONBOARDING_SCENARIOS } from "../tools/ui-screens/screens-onboarding.mjs";

const manifest = loadManifest(), inventory = loadRoleInventory();
assert.deepEqual(validateRoleInventory(inventory, manifest), [], "current manifest and semantic inventory agree");
assert.deepEqual(requiredBoundaryExceptionRequests(inventory.exceptions, "workout/rest-running"), [
  { selector: ".restinline__fill", kind: "boundary" },
], "required boundary exceptions enter rendered-role measurement for their owned catalog state");
assert.deepEqual(requiredBoundaryExceptionRequests(inventory.exceptions, "workout/rest-done"), [],
  "the run-out state has no drain bar to measure");
assert.equal(Object.keys(inventory.catalogStates).length, manifest.screens.length, "every live catalog state has an explicit owner");
assert.ok(inventory.components.some((item) => item.roles.elevation === "flat"), "flat content has an explicit role");
for (const role of ["selected", "floating", "modal", "persistent-action"]) {
  assert.ok(inventory.components.some((item) => item.roles.elevation === role || item.roles.elevation?.includes(role)), `${role} is represented`);
}
for (const role of ["required", "decorative"]) {
  assert.ok(inventory.components.some((item) => item.roles.boundary === role), `${role} boundary is represented`);
}

const missing = structuredClone(inventory);
delete missing.catalogStates[Object.keys(missing.catalogStates)[0]];
assert.ok(validateRoleInventory(missing, manifest).some((error) => error.startsWith("unmapped catalog state")), "new or missing catalog state fails closed");
const ambiguous = structuredClone(inventory);
ambiguous.components.push({ ...ambiguous.components[0] });
assert.ok(validateRoleInventory(ambiguous, manifest).some((error) => error.startsWith("ambiguous component selector")), "duplicate selector is rejected rather than assigned a role by order");
const missingFocus = structuredClone(inventory);
missingFocus.components.find((item) => item.roles.control).states = ["default", "disabled"];
assert.ok(validateRoleInventory(missingFocus, manifest).some((error) => error.includes("needs shared focus-visible control state")),
  "a control role cannot silently lose its shared focus state");
const missingDisabled = structuredClone(inventory);
missingDisabled.components.find((item) => item.roles.control).states = ["default", "focus-visible"];
assert.ok(validateRoleInventory(missingDisabled, manifest).some((error) => error.includes("needs disabled state or an explicit non-applicability reason")),
  "a missing disabled state needs an exact rationale");
const badException = structuredClone(inventory);
badException.exceptions.push({ selector: ".bad" });
assert.ok(validateRoleInventory(badException, manifest).some((error) => error.startsWith("exception .bad needs")), "an unowned exception cannot suppress a failure");
const firstRecipe = inventory.rootRecipeOwners[0].id;
const missingRecipeOwner = structuredClone(inventory);
delete missingRecipeOwner.rootRecipeOwners[0].rationale;
assert.ok(validateRoleInventory(missingRecipeOwner, manifest).some((error) => error.startsWith(`root recipe ${firstRecipe} needs`)),
  "a root helper recipe cannot escape semantic ownership");
const staleRecipeState = structuredClone(inventory);
staleRecipeState.rootRecipeOwners[0].catalogStates.push("workout/not-a-live-state");
assert.ok(validateRoleInventory(staleRecipeState, manifest).some((error) => error.includes(`root recipe ${firstRecipe} names stale catalog state`)),
  "root recipe ownership must point at live catalog states");
const broadException = structuredClone(inventory);
broadException.exceptions.push({ ...inventory.exceptions[0], selector: "body *" });
assert.ok(validateRoleInventory(broadException, manifest).some((error) => error.startsWith("exception body * needs")),
  "a subtree wildcard cannot exempt unknown controls");
const tagException = structuredClone(inventory);
tagException.exceptions.push({ ...inventory.exceptions[0], selector: "body button" });
assert.ok(validateRoleInventory(tagException, manifest).some((error) => error.startsWith("exception body button needs")),
  "a tag-wide exception cannot exempt every button");

const css = readFileSync(join(ROOT, "styles.css"), "utf8");
const motionPolishCss = readFileSync(join(ROOT, "motion-polish.css"), "utf8");
const rootCss = [...css.matchAll(/(?:^|\})\s*:root(?:\[data-theme="dark"\])?\s*\{([^}]*)\}/g)].map((match) => match[1]).join("\n");
assert.equal(new Set(inventory.rootRecipeOwners.map((item) => item.token)).size, inventory.rootRecipeOwners.length,
  "each P6 root helper recipe has one semantic owner, even when it serves multiple contexts");
for (const recipe of inventory.rootRecipeOwners) {
  assert(rootCss.includes(`${recipe.token}:`), `${recipe.token} is a declared root helper token`);
  assert(css.includes(`var(${recipe.token})`), `${recipe.token} has a live CSS consumer`);
  for (const selector of recipe.selectors) assert(css.includes(selector), `${recipe.id} records its rendered consumer ${selector}`);
}
assert.equal(cssLiteralDebt(css, inventory.exceptions).length, 0, "P6 removes all unauthorized CSS literal debt");
assert.deepEqual(uninventoriedSharedComponents(css, inventory), [], "every Plan 064 shared component block has an inventory row");
assert.deepEqual(
  (() => {
    const end = css.indexOf("*/", css.indexOf(SHARED_COMPONENTS_MARKER)) + 2;
    return uninventoriedSharedComponents(`${css.slice(0, end)}\n.unreviewedband{display:block}\n.unreviewedband__title{display:block}\n${css.slice(end)}`, inventory);
  })(),
  ["unreviewedband"],
  "an unrendered shared component without an inventory row is rejected",
);
assert.deepEqual(
  uninventoriedSharedComponents(`.outside{display:block}\n${SHARED_COMPONENTS_MARKER} */\n.verdictmark{display:flex}\n/* ---- Next section ---- */\n.later{display:block}\n`, inventory),
  [],
  "only blocks inside the marked section are held to the rule",
);
// The shared verdict mark's hold ("=") and recover (a return arrow) variants, and the maintained outcome, which
// draws the same "=" as hold (one meaning per glyph, owner decision on #295, 2026-10-01): drawn masks in ink.
// Orange is the up glyph alone (section 8.8), so none of them may name the accent or the action colour.
const ruleFor = (selector) => {
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (selectors.split(",").some((s) => s.trim() === selector)) return body;
  }
  return "";
};
const glyphRule = (variant) => ruleFor(`.verdictmark--${variant} .verdictmark__glyph`);
for (const [variant, mask] of [["hold", "hold"], ["recover", "recover"], ["maintained", "hold"]]) {
  assert.ok(rootCss.includes(`--verdict-${mask}:url(`), `--verdict-${mask} is a drawn mask, not a typed character`);
  const rule = glyphRule(variant);
  assert.ok(rule.includes("background:var(--color-ink)") && rule.includes(`var(--verdict-${mask})`),
    `.verdictmark--${variant} draws its mask in ink`);
  assert.ok(!/--accent|--color-action|--color-improved|--positive/.test(rule), `.verdictmark--${variant} never uses the accent`);
  assert.ok(!/display\s*:\s*none/.test(rule), `.verdictmark--${variant} is drawn, never hidden`);
}
// Maintained is distinct from up and down: those draw the arrow mask, maintained draws "=".
assert.ok(ruleFor(".verdictmark__glyph").includes("var(--arrow)"), "the base glyph is the arrow");
assert.ok(glyphRule("maintained").includes("var(--verdict-hold)") && !glyphRule("maintained").includes("var(--arrow)"),
  "maintained draws \"=\", not the arrow that up and down share");
assert.ok(glyphRule("up").includes("var(--color-action)") && glyphRule("down").includes("var(--color-ink)"),
  "up stays the only accent mark and down stays ink");
assert.notEqual(rootCss.match(/--verdict-hold:(url\([^;]*\));/)?.[1], rootCss.match(/--verdict-recover:(url\([^;]*\));/)?.[1],
  "hold and recover are different glyphs");
assert.equal(cssCompatibilityAliasDebt(css).length, 0, "P6 removes all obsolete compatibility aliases");
assert.equal(cssLiteralDebt(motionPolishCss, inventory.exceptions).length, 0, "motion-polish.css has no unauthorized CSS literal debt");
assert.equal(cssCompatibilityAliasDebt(motionPolishCss).length, 0, "motion-polish.css has no obsolete compatibility aliases");
for (const declaration of ["font-size:15px", "font-weight:700", "border-radius:11px", "box-shadow:0 2px 8px #777", "color:#808080", "border:1px solid #ccc", "background:red"]) {
  const bad = `.seeded { ${declaration}; }`;
  assert.equal(cssLiteralDebt(bad).length, 1, `checker rejects seeded ${declaration} outside token definitions`);
}
assert.equal(cssLiteralDebt(".seeded { background:var(--band-orange-bg); color:var(--band-orange-ink); --x:var(--band-orange-cta-mark); }").length, 0,
  "a token whose name contains a colour keyword is not a colour literal");
assert.equal(cssLiteralDebt(".seeded { background:orange; }").length, 1, "the colour keyword itself is still rejected");
for (const weight of [400, 500, 600]) {
  assert.equal(cssLiteralDebt(`.seeded { font-weight:${weight}; }`).length, 0,
    `the frozen ${weight} text weight remains supported`);
}
assert.equal(cssLiteralDebt(".seeded { font-weight:var(--weight-semibold); }").length, 0,
  "the semantic semibold token remains supported");
assert.equal(cssLiteralDebt("@font-face { font-weight:100 700; }").length, 0,
  "a variable font face range is capability metadata, not a rendered text weight");
assert.equal(cssLiteralDebt('.seeded{background:#161513 url("icon.png") center/cover no-repeat}').length, 1,
  "checker rejects a color literal even when the same declaration loads an image");
assert.equal(cssLiteralDebt(".seeded{--plate:#F4F2EF}").length, 1,
  "checker rejects a color literal on an unclassified custom property");
assert.equal(cssLiteralDebt(".seeded{color:rebeccapurple}").length, 1,
  "checker rejects every CSS named color, including rebeccapurple");
assert.equal(cssLiteralDebt(".seeded{background:color(display-p3 1 0 0)}").length, 1,
  "checker rejects a Color 4 display-p3 literal");
assert.equal(cssLiteralDebt(".seeded{font-size:13ch}").length, 1,
  "checker rejects font-size literals using character-relative units");
assert.equal(cssLiteralDebt(":root { --font-body:1rem; --radius-control:8px; --ink:#1B1A17; }").length, 0,
  "token definitions are the one place values are declared");
assert.equal(cssLiteralDebt(".art { border-radius:50%; font-size:0; } .square { border-radius:0; }").length, 0,
  "intrinsic circles, squares and glyph-free icon boxes are not migration debt");
assert.equal(cssLiteralDebt(".sheet { border-radius:var(--radius-prominent) var(--radius-prominent) 0 0; }").length, 0,
  "tokenized sheet corners can keep square edges without creating radius debt");
assert.equal(cssLiteralDebt(".round { border-radius:50%; }").length, 0,
  "the existing intrinsic-circle radius allowance remains exact");
assert.equal(cssLiteralDebt(".semicircle { border-radius:50% 50% 0 0; }").length, 1,
  "a partial raw percentage shape does not inherit the circle allowance");
assert.equal(cssLiteralDebt(".settings-identity__mark { background:#eee; }", inventory.exceptions).length, 1,
  "a documented artwork exception cannot hide a different color at the same selector");
const invalidState = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--state", "missing/state"], { cwd: ROOT, encoding: "utf8" });
assert.equal(invalidState.status, 1, "a misspelled catalog state cannot make the checker pass on zero renders");
assert.match(invalidState.stderr, /unknown catalog state missing\/state/);
const fixtureDir = mkdtempSync(join(tmpdir(), "taurifer-ui-literal-"));
try {
  const fixture = join(fixtureDir, "bad.css");
  const polishFixture = join(fixtureDir, "motion-polish.css");
  writeFileSync(fixture, ".seeded { font-size:15px; }");
  const rejected = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(rejected.status, 1, "actual checker rejects an isolated literal artifact");
  assert.match(rejected.stderr, /unapproved CSS literals/, "checker names the violation");
  writeFileSync(fixture, ".seeded { font-size:var(--font-size-body); }");
  const repaired = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(repaired.status, 0, "same checker accepts the repaired token declaration");
  writeFileSync(fixture, ".seeded { border-radius:var(--radius); }");
  const compatibility = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(compatibility.status, 1, "actual checker rejects a consumer left on a retired compatibility alias");
  assert.match(compatibility.stderr, /obsolete CSS alias references/, "checker names the compatibility violation");
  writeFileSync(fixture, ".seeded { border-radius:var(--radius-control); }");
  const migrated = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(migrated.status, 0, "same checker accepts the migrated semantic radius token");
  writeFileSync(fixture, ".seeded { font-weight:700; }");
  const badWeight = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(badWeight.status, 1, "actual strict checker rejects a weight outside the frozen typography scale");
  assert.match(badWeight.stderr, /unapproved CSS literals/, "checker reports out-of-scale weight as debt");
  writeFileSync(fixture, ".seeded { color:rebeccapurple; background:color(display-p3 1 0 0); font-size:13ch; }");
  const modernLiterals = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(modernLiterals.status, 1, "strict checker rejects modern named-color, color-space and font-size literals");
  assert.match(modernLiterals.stdout, /rebeccapurple/, "strict checker identifies the modern named color");
  assert.match(modernLiterals.stdout, /display-p3/, "strict checker identifies the modern color-space literal");
  assert.match(modernLiterals.stdout, /13ch/, "strict checker identifies a character-relative font-size");
  writeFileSync(fixture, ".seeded { color:var(--color-ink); }");
  writeFileSync(polishFixture, ".polish { font-weight:650; box-shadow:0 2px 4px #123456; border-radius:var(--radius-legacy); }");
  const polishDebt = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture, "--css", polishFixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(polishDebt.status, 1, "actual checker scans every supplied stylesheet for literal and alias debt");
  assert.match(polishDebt.stdout, new RegExp(`${polishFixture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:1`), "checker identifies the violating motion-polish source");
  assert.match(polishDebt.stdout, /font-weight: 650/, "checker detects an out-of-scale weight in motion-polish.css");
  assert.match(polishDebt.stderr, /obsolete CSS alias references/, "checker rejects an obsolete alias in motion-polish.css");
} finally { rmSync(fixtureDir, { recursive: true, force: true }); }
if (process.argv.includes("--css-debt-only")) {
  console.log("ui-system CSS debt negatives passed");
  process.exit(0);
}
assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21, "WCAG contrast oracle handles black/white");
assert.ok(contrastRatio([128, 128, 128], [255, 255, 255]) < 4.5, "3.95:1 body text is below AA");
const roleOf = (selector) => inventory.components.find((item) => item.selector === selector)?.roles.control;
assert.equal(roleOf(".program-editor__replace:not([id])"), "secondary", "Replace is a reversible identity edit");
assert.equal(roleOf(".program-editor__remove:not([id])"), "destructive", "Remove discards an exercise");
assert.equal(roleOf(".entry__exercise-action:not([id])"), "selection", "Avoid is a reversible preference, not Remove");
assert.equal(roleOf(".stepbtn:not([id])"), "adjustment", "rapid workout stepper changes a numeric value");
assert.equal(roleOf('button[data-role="adjust"]'), "adjustment", "deliberate program stepper keeps numeric meaning");
assert.equal(roleOf(".rxrow:not([id])"), "quiet-navigation", "Program prescription row drills into the exercise");
assert.equal(inventory.components.find((item) => item.selector === 'button[data-role="adjust"]')?.states.includes("selected"), false,
  "numeric Program set steppers do not claim a selected state");
assert.equal(roleOf("#entryFreeformStartOver"), "destructive", "Start over discards staged work");

const focusSkipSelectors = ["#exActionSkipBtn"];
const focusSkipStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
function focusSkipContractErrors(candidate) {
  const errors = [];
  const expected = [
    ["#exActionSkipBtn", "selection", null, []],
  ];
  for (const [selector, role, variant, facets] of expected) {
    const members = candidate.components.filter((item) => item.selector === selector);
    const item = members[0];
    if (members.length !== 1 || item.roles.control !== role || item.variant !== variant ||
        JSON.stringify(item.facets) !== JSON.stringify(facets) ||
        JSON.stringify(item.states) !== JSON.stringify(focusSkipStates)) {
      errors.push(`${selector} must remain an unselected Skip/Restore control with its frozen role and variant`);
    }
  }
  return errors;
}
assert.deepEqual(focusSkipContractErrors(inventory), [], "Focus Skip/Restore controls have no selected state");
for (const selector of focusSkipSelectors) {
  const selectedFocusSkip = structuredClone(inventory);
  selectedFocusSkip.components.find((item) => item.selector === selector).states.push("selected");
  assert.ok(focusSkipContractErrors(selectedFocusSkip).some((error) => error.includes(selector)),
    `${selector} cannot claim a selected state after activation rerenders or closes its owner`);
}

const focusAdjustmentSelectors = [".stepbtn:not([id])", "#restMinus", "#restPlus"];
const focusAdjustmentStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
function focusAdjustmentContractErrors(candidate) {
  const errors = [];
  const expected = [
    [".stepbtn:not([id])", "rapid-workout-stepper"],
    ["#restMinus", null],
    ["#restPlus", null],
  ];
  for (const [selector, variant] of expected) {
    const members = candidate.components.filter((item) => item.selector === selector);
    const item = members[0];
    if (members.length !== 1 || item.roles.control !== "adjustment" || item.variant !== variant ||
        item.facets.length !== 0 || JSON.stringify(item.states) !== JSON.stringify(focusAdjustmentStates)) {
      errors.push(`${selector} must remain an unselected numeric adjustment with its frozen variant`);
    }
  }
  return errors;
}
assert.deepEqual(focusAdjustmentContractErrors(inventory), [], "Focus adjustment controls have no selected state");
for (const selector of focusAdjustmentSelectors) {
  const selectedFocusAdjustment = structuredClone(inventory);
  selectedFocusAdjustment.components.find((item) => item.selector === selector).states.push("selected");
  assert.ok(focusAdjustmentContractErrors(selectedFocusAdjustment).some((error) => error.includes(selector)),
    `${selector} cannot claim a selected state after changing a number`);
}
// The retired rest-timer sheet's dial and play/pause are gone with it; the inline rest controls replace them (R3f).
assert.ok(!inventory.components.some((item) => item.selector === "#restPlayPause") &&
  !inventory.exceptions.some((item) => item.selector.includes("restdial")) &&
  !inventory.progressCandidateSelectors.some((selector) => selector.includes("restdial")) &&
  !Object.keys(inventory.catalogStates).some((key) => key.startsWith("workout/rest-timer")),
"the retired rest-timer sheet leaves no inventory row, exception or catalog owner behind");
{
  const inlineRest = (selector) => inventory.components.filter((item) => item.selector === selector);
  const roles = { ".restpad--adjust:not([id])": "adjustment", ".restpad--toggle:not([id])": "selection", ".restpad--skip:not([id])": "secondary" };
  for (const [selector, control] of Object.entries(roles)) {
    const [row, ...rest] = inlineRest(selector);
    assert.ok(row && !rest.length && row.roles.control === control && row.catalogStates.includes("workout/rest-running"),
      `${selector} is one selector-exact ${control} row rendered by workout/rest-running`);
  }
  const bar = inventory.exceptions.find((item) => item.selector === ".restinline__fill");
  assert.ok(bar && bar.boundary === "required" && /falsify its denominator/.test(bar.rationale) &&
    JSON.stringify(bar.catalogStates) === JSON.stringify(["workout/rest-running"]),
  "the drain bar's fill is a selector-exact countdown exception with the arc's rationale");
  assert.ok(!inventory.progressCandidateSelectors.some((selector) => /restinline/.test(selector)),
    "the drain bar is not a progress candidate selector");
  const clock = inventory.contextualVariants.find((item) => item.id === "rest-clock-scale");
  assert.ok(clock && clock.selector === ".restinline__clock" && JSON.stringify(clock.catalogStates) === JSON.stringify(["workout/rest-running"]),
    "the responsive rest clock variant is selector-exact to the inline clock");
}

const whyCloseStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
function whyCloseContractErrors(candidate) {
  const members = candidate.components.filter((item) => item.selector === "#whyClose");
  const item = members[0];
  if (members.length !== 1 || item.roles.control !== "quiet-navigation" || item.variant !== null ||
      JSON.stringify(item.facets) !== JSON.stringify(["icon-only"]) ||
      JSON.stringify(item.states) !== JSON.stringify(whyCloseStates)) {
    return ["#whyClose must remain an icon-only quiet-navigation control without a selected state"];
  }
  return [];
}
assert.deepEqual(whyCloseContractErrors(inventory), [], "Why-sheet close declares its frozen icon-only recipe");
const whyCloseWithoutIconFacet = structuredClone(inventory);
whyCloseWithoutIconFacet.components.find((item) => item.selector === "#whyClose").facets = [];
assert.ok(whyCloseContractErrors(whyCloseWithoutIconFacet).some((error) => error.includes("#whyClose")),
  "a glyph-only close action cannot omit its icon-only facet");

const importDoorSelectors = ["#entryFreeformStart", ".entry-card.entry-card--secondary:not([id])"];
const importDoorStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
function importDoorContractErrors(candidate) {
  const errors = [];
  for (const selector of importDoorSelectors) {
    const members = candidate.components.filter((item) => item.selector === selector);
    const item = members[0];
    if (members.length !== 1 || item.roles.control !== "quiet-navigation" || item.variant !== "entry-alternative" ||
        item.facets.length !== 0 || JSON.stringify(item.states) !== JSON.stringify(importDoorStates) ||
        !item.catalogStates.includes("onboarding-start/hub-own-open")) {
      errors.push(`${selector} must enter import as an unselected entry-alternative navigation control`);
    }
  }
  return errors;
}
assert.deepEqual(importDoorContractErrors(inventory), [], "both hub import doors share the exact unselected navigation recipe");
const asymmetricImportDoors = structuredClone(inventory);
asymmetricImportDoors.components.find((item) => item.selector === "#entryFreeformStart").roles.control = "selection";
assert.ok(importDoorContractErrors(asymmetricImportDoors).some((error) => error.includes("#entryFreeformStart")),
  "a future freeform/file role asymmetry fails the frozen contract");
const selectedImportDoor = structuredClone(inventory);
selectedImportDoor.components.find((item) => item.selector === "#entryFreeformStart").states.push("selected");
assert.ok(importDoorContractErrors(selectedImportDoor).length, "the hub cannot claim a selected state it does not render");

const importModeSwitchSelectors = ["#entryFreeformSwitch", "#entryFreeformFile"];
const importModeSwitchStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
const importModeSwitchCatalog = {
  "#entryFreeformSwitch": ["onboarding-import/source"],
  "#entryFreeformFile": ["onboarding-import/freeform-empty", "onboarding-import/freeform-filled",
    "onboarding-import/freeform-stage2", "onboarding-import/freeform-stage3", "onboarding-import/freeform-unreadable"],
};
function importModeSwitchContractErrors(candidate) {
  const errors = [];
  for (const selector of importModeSwitchSelectors) {
    const members = candidate.components.filter((item) => item.selector === selector);
    const item = members[0];
    if (members.length !== 1 || item.roles.control !== "quiet-navigation" || item.variant !== null ||
        item.facets.length !== 0 || JSON.stringify(item.states) !== JSON.stringify(importModeSwitchStates) ||
        JSON.stringify(item.catalogStates) !== JSON.stringify(importModeSwitchCatalog[selector])) {
      errors.push(`${selector} must be an ordinary unselected import-subview navigation control`);
    }
  }
  return errors;
}
assert.deepEqual(importModeSwitchContractErrors(inventory), [],
  "both inner import switches share the exact quiet-navigation contract");
for (const selector of importModeSwitchSelectors) {
  const selectedSwitch = structuredClone(inventory);
  selectedSwitch.components.find((item) => item.selector === selector).states.push("selected");
  assert.ok(importModeSwitchContractErrors(selectedSwitch).some((error) => error.includes(selector)),
    `${selector} cannot claim a selected state after it leaves the rendered subview`);
}
const asymmetricImportModeSwitch = structuredClone(inventory);
asymmetricImportModeSwitch.components.find((item) => item.selector === "#entryFreeformSwitch").roles.control = "selection";
assert.ok(importModeSwitchContractErrors(asymmetricImportModeSwitch).some((error) => error.includes("#entryFreeformSwitch")),
  "the File and Freeform subview switches cannot drift to different control roles");

const importReviewSelectionSelector = ".improw__btn:not(.improw__btn--change):not([id])";
const importReviewChangeSelector = ".improw__btn.improw__btn--change:not([id])";
const importReviewStates = ["default", "hover", "pressed", "focus-visible", "disabled"];
const importReviewCatalog = ["onboarding-import/review"];
function importReviewActionContractErrors(candidate) {
  const errors = [];
  const expected = [
    [importReviewSelectionSelector, "selection"],
    [importReviewChangeSelector, "quiet-navigation"],
  ];
  for (const [selector, role] of expected) {
    const members = candidate.components.filter((item) => item.selector === selector);
    const item = members[0];
    if (members.length !== 1 || item.roles.control !== role || item.variant !== null || item.facets.length !== 0 ||
        JSON.stringify(item.states) !== JSON.stringify(importReviewStates) ||
        JSON.stringify(item.catalogStates) !== JSON.stringify(importReviewCatalog)) {
      errors.push(`${selector} must use the exact Import review ${role} contract without selected state`);
    }
  }
  if (candidate.components.some((item) => item.selector === ".improw__btn:not([id])")) {
    errors.push("Import review mapping and Change actions must have separate non-overlapping owners");
  }
  return errors;
}
assert.deepEqual(importReviewActionContractErrors(inventory), [],
  "Import review mapping choices and Change have distinct, unselected semantic owners");
const selectedImportReviewAction = structuredClone(inventory);
selectedImportReviewAction.components.find((item) => item.selector === importReviewSelectionSelector).states.push("selected");
assert.ok(importReviewActionContractErrors(selectedImportReviewAction).length,
  "a mapping action cannot retain a selected state after its alternatives leave the row");
const selectedImportReviewChange = structuredClone(inventory);
selectedImportReviewChange.components.find((item) => item.selector === importReviewChangeSelector).states.push("selected");
assert.ok(importReviewActionContractErrors(selectedImportReviewChange).length,
  "Change cannot claim a selected state when it is only a temporary route back to editing");
const wrongImportReviewChange = structuredClone(inventory);
wrongImportReviewChange.components.find((item) => item.selector === importReviewChangeSelector).roles.control = "selection";
assert.ok(importReviewActionContractErrors(wrongImportReviewChange).length,
  "Change cannot share the mapping actions' selection role");
const asymmetricImportReview = structuredClone(inventory);
asymmetricImportReview.components.find((item) => item.selector === importReviewSelectionSelector).roles.control = "quiet-navigation";
assert.ok(importReviewActionContractErrors(asymmetricImportReview).length,
  "mapping choices cannot drift to the Change action's navigation role");

const preferenceSelector = ".entry__exercise-action:not([id])";
const preferenceCatalog = ["onboarding-custom/exercise-preferences"];
function preferenceContractErrors(candidate) {
  const errors = [];
  const members = candidate.components.filter((item) => item.selector === preferenceSelector);
  const item = members[0];
  if (members.length !== 1 || item.roles.control !== "selection" || item.variant !== null ||
      JSON.stringify(item.catalogStates) !== JSON.stringify(preferenceCatalog) ||
      item.states.includes("selected") || !["default", "hover", "pressed", "focus-visible", "disabled"].every((state) => item.states.includes(state))) {
    errors.push("exercise-preference actions need one unselected selection owner");
  }
  if (candidate.contextualVariants.some((variant) => variant.selector.includes("entry__exercise-action"))) {
    errors.push("exercise-preference actions cannot acquire an accent variant");
  }
  return errors;
}
assert.deepEqual(preferenceContractErrors(inventory), [], "Include and Avoid share one ordinary selection recipe in their exact catalog state");
const tintedPreference = structuredClone(inventory);
tintedPreference.components.find((item) => item.selector === preferenceSelector).variant = "accent-include";
assert.ok(preferenceContractErrors(tintedPreference).length, "a visual accent cannot silently become a preference state");
const selectedPreference = structuredClone(inventory);
selectedPreference.components.find((item) => item.selector === preferenceSelector).states.push("selected");
assert.ok(preferenceContractErrors(selectedPreference).length, "search-result actions cannot claim the list's selected state");
const widenedPreferenceOwner = structuredClone(inventory);
widenedPreferenceOwner.components.find((item) => item.selector === preferenceSelector).catalogStates.push("onboarding-custom/result");
assert.ok(preferenceContractErrors(widenedPreferenceOwner).length, "preference buttons cannot claim another catalog state");

const sameSet = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
// The final landing's catalog states (Plan 064 R2): the hero, and the scrolled bands below it.
const landingScrolled = ["proof", "ways", "track", "data", "faq-open", "close"].map((name) => `onboarding-start/first-run-${name}`);
const landingHero = ["onboarding-shared/invalid", "onboarding-start/first-run"];
const landingStates = [...landingHero, ...landingScrolled];
const landingEverywhere = ["onboarding-shared/gate", ...landingStates];
// The returning landing (owner decision on #295, comment 5941692606) is the same page, condensed: it shows the creation and
// Track actions, the headline and the bands that stay, but not the proof, the outcomes or the persistent Build control.
const landingReturning = ["onboarding-start/first-run-returning", "onboarding-start/first-run-returning-resume"];
const radiusRecipe = [
  { selector: ".firstrun-proof__glass", condition: "default", token: "--radius-landing-stage" },
  { selector: ".firstrun-step__crop", condition: "default", token: "--radius-landing-crop" },
  { selector: ".firstrun-proof__glass", condition: "max-width:340px", token: "--radius-landing-stage-compact" },
];
function radiusContractErrors(candidate) {
  const matches = candidate.contextualVariants.filter((item) => item.id === "landing-device-stage-radius");
  const variant = matches[0];
  if (matches.length !== 1 || variant.selector !== ".firstrun-proof__glass, .firstrun-step__crop" || variant.role !== "radius:landing-device-stage" ||
      !sameSet(variant.catalogStates, landingEverywhere) ||
      JSON.stringify(variant.radiusRecipes) !== JSON.stringify(radiusRecipe)) return ["landing stage radius scope or recipe changed"];
  return [];
}
assert.equal(inventory.contextualVariants.length, 15, "the landing recipes, radius and headline plus the workout shelf make 15 contextual variants (the summary hero is a title-role consumer, not a variant)");
assert.deepEqual(radiusContractErrors(inventory), [], "the proof's phone plate, its compact plate and the step crop retain the Plan 054 geometry");
const flattenedRadius = structuredClone(inventory);
flattenedRadius.contextualVariants.find((item) => item.id === "landing-device-stage-radius").radiusRecipes[1].token = "--radius-prominent";
assert.ok(radiusContractErrors(flattenedRadius).length, "mapping the crop to prominent is rejected");
const widenedRadius = structuredClone(inventory);
widenedRadius.contextualVariants.find((item) => item.id === "landing-device-stage-radius").selector = ".firstrun *";
assert.ok(radiusContractErrors(widenedRadius).length, "landing radius cannot spread to the whole gate");
const widenedRadiusOwner = structuredClone(inventory);
widenedRadiusOwner.contextualVariants.find((item) => item.id === "landing-device-stage-radius").catalogStates.push("onboarding-shared/preview");
assert.ok(radiusContractErrors(widenedRadiusOwner).length, "stage radius cannot claim the entry preview state");

// Owner decision L-1 (PR #295): the ink pill with its arrow, the underlined Track link, and the one floating Build control.
const landingRecipes = [
  { id: "landing-ink-primary", role: "primary", boundary: "decorative", elevation: undefined,
    selectors: ["#firstRunCreate", "#firstRunCreateClose", "#firstRunSharedStart"], states: [...landingEverywhere, ...landingReturning],
    stateFor: (selector) => selector === "#firstRunSharedStart" ? ["onboarding-shared/gate"] : [...landingStates, ...landingReturning] },
  { id: "landing-text-link", role: "quiet-navigation", boundary: undefined, elevation: undefined,
    selectors: ["#firstRunImport", "#firstRunImportClose"], states: [...landingStates, ...landingReturning], stateFor: () => [...landingStates, ...landingReturning] },
  { id: "landing-sticky-build", role: "primary", boundary: "decorative", elevation: "floating",
    selectors: ["#firstRunCreateDock"], states: landingScrolled, stateFor: () => landingScrolled },
];
function landingContractErrors(candidate) {
  const errors = [];
  for (const recipe of landingRecipes) {
    const declarations = candidate.contextualVariants.filter((item) => item.id === recipe.id);
    const variant = declarations[0];
    if (declarations.length !== 1 || variant.role !== recipe.role ||
        JSON.stringify(variant.selector.split(/,\s*/)) !== JSON.stringify(recipe.selectors) ||
        !sameSet(variant.catalogStates, recipe.states)) errors.push(`${recipe.id} declaration`);
    const members = candidate.components.filter((item) => item.variant === recipe.id);
    if (JSON.stringify(members.map((item) => item.selector)) !== JSON.stringify(recipe.selectors)) errors.push(`${recipe.id} exact members`);
    for (const selector of recipe.selectors) {
      const item = candidate.components.find((member) => member.selector === selector);
      if (!item || item.roles.control !== recipe.role || item.roles.boundary !== recipe.boundary || item.roles.elevation !== recipe.elevation ||
          !sameSet(item.catalogStates, recipe.stateFor(selector)) ||
          !item.states.includes("focus-visible") || !item.states.includes("disabled")) errors.push(`${selector} role, boundary, state or catalog owner`);
    }
  }
  const hero = candidate.contextualVariants.find((item) => item.id === "landing-headline-scale");
  if (hero?.selector !== ".firstrun-h1" || !sameSet(hero.catalogStates, [...landingEverywhere, ...landingReturning])) errors.push("landing-headline-scale declaration");
  if (candidate.contextualVariants.some((item) => item.id === "landing-climax-data")) errors.push("retired climax variant is back");
  return errors;
}
assert.deepEqual(landingContractErrors(inventory), [], "the creation pill, the Track link and the sticky Build control have exact recipes and only their rendered states");
const wrongLandingRole = structuredClone(inventory);
wrongLandingRole.components.find((item) => item.selector === "#firstRunImport").roles.control = "secondary";
assert.ok(landingContractErrors(wrongLandingRole).some((error) => error.includes("#firstRunImport")), "visual resemblance cannot silently reclassify import");
const widenedLandingVariant = structuredClone(inventory);
widenedLandingVariant.contextualVariants.find((item) => item.id === "landing-text-link").selector = ".firstrun__link";
assert.ok(landingContractErrors(widenedLandingVariant).includes("landing-text-link declaration"), "a broad landing selector cannot replace exact IDs");
const wrongLandingOwner = structuredClone(inventory);
wrongLandingOwner.components.find((item) => item.selector === "#firstRunCreateClose").catalogStates.push("onboarding-shared/preview");
assert.ok(landingContractErrors(wrongLandingOwner).some((error) => error.includes("#firstRunCreateClose")), "landing recipe cannot spread into the shared proposal state");
const flatDock = structuredClone(inventory);
delete flatDock.components.find((item) => item.selector === "#firstRunCreateDock").roles.elevation;
assert.ok(landingContractErrors(flatDock).some((error) => error.includes("#firstRunCreateDock")), "the sticky Build control cannot lose its floating elevation role");
const gateDock = structuredClone(inventory);
gateDock.components.find((item) => item.selector === "#firstRunCreateDock").catalogStates.push("onboarding-shared/gate");
assert.ok(landingContractErrors(gateDock).some((error) => error.includes("#firstRunCreateDock")), "the sticky Build control cannot claim the received-program gate");

const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
setCaptureBase(preview.env.REPFORGE_URL);
const browser = await launchChromium();
let context;
try {
  const capture = { flow: "onboarding-start", screen: "first-run", viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "normal" };
  const opened = await openPage(browser, manifest, capture, onboardingState("onboarding-start/first-run", "en"));
  context = opened.context;
  await ONBOARDING_SCENARIOS["onboarding-start/first-run"](opened.page);
  await settle(opened.page);
  const tokenContract = async () => opened.page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const value = (name) => root.getPropertyValue(name).trim();
    const expected = {
      "--font-size-label": ".6875rem", "--font-size-caption": ".75rem", "--font-size-body-small": ".875rem",
      "--font-size-body": "1rem", "--font-size-control": "1rem", "--font-size-subtitle": "1.125rem",
      "--font-size-metric": "1.375rem", "--font-size-section-title": "1.5rem", "--font-size-feature-title": "1.75rem",
      "--font-size-title": "1.875rem", "--font-size-display": "2.5rem",
      "--font-size-landing-headline": "2.375rem",
      "--font-size-landing-headline-wide": "3.25rem", "--font-size-landing-climax": "min(4.25rem,16vw)",
      "--font-size-landing-climax-wide": "min(5.5rem,7.5vw)", "--font-size-rest-clock": "clamp(2rem,10cqi,2.625rem)",
      "--line-tight": "1.1", "--line-standard": "1.4", "--line-reading": "1.55",
      "--weight-regular": "400", "--weight-medium": "500", "--weight-semibold": "600",
      "--radius-none": "0", "--radius-compact": "4px", "--radius-control": "8px",
      "--radius-surface": "12px", "--radius-prominent": "16px", "--radius-pill": "999px",
      "--radius-round": "50%",
      "--radius-landing-stage": "24px", "--radius-landing-stage-compact": "20px", "--radius-landing-crop": "14px",
      "--control-target": "44px", "--control-icon-size": "24px", "--control-disabled-opacity": ".4",
    };
    const errors = Object.entries(expected).filter(([name, wanted]) => value(name) !== wanted)
      .map(([name, wanted]) => `${name}: ${value(name)} != ${wanted}`);
    // Owner decision #295 comment 5965828337: the summary hero is a 30px title-role consumer, so no 34px token returns.
    for (const alias of ["--font-size-summary-hero", "--radius-legacy", "--radius", "--r", "--shadow", "--display", "--body", "--mono"]) {
      if (value(alias)) errors.push(`${alias} must remain absent`);
    }
    if (value("--font-size-focal-data") !== value("--font-size-feature-title")) {
      errors.push("--font-size-focal-data no longer resolves to --font-size-feature-title");
    }
    for (const name of ["--elevation-selected-shadow", "--elevation-floating-shadow", "--elevation-focus-shadow",
      "--elevation-modal-shadow", "--elevation-dialog-shadow", "--elevation-persistent-shadow",
      "--elevation-nav-shadow", "--elevation-program-dock-shadow", "--boundary-selected", "--boundary-floating", "--boundary-modal",
      "--boundary-persistent", "--boundary-required", "--boundary-decorative", "--color-action-text",
      "--color-improved", "--color-declined", "--color-maintained", "--color-warning", "--color-destructive",
      "--color-focus", "--color-disabled-reason"]) {
      if (!value(name)) errors.push(`${name} missing`);
    }
    for (const name of ["--control-primary-bg", "--control-primary-ink", "--control-primary-boundary",
      "--control-primary-disabled-bg", "--control-primary-disabled-ink", "--control-secondary-bg", "--control-secondary-ink",
      "--control-secondary-boundary", "--control-quiet-bg", "--control-quiet-ink",
      "--control-quiet-boundary", "--control-destructive-bg", "--control-destructive-ink",
      "--control-destructive-boundary", "--control-disclosure-bg", "--control-disclosure-ink",
      "--control-disclosure-boundary", "--control-selection-bg", "--control-selection-ink",
      "--control-selection-boundary", "--control-selection-active-bg", "--control-adjustment-bg",
      "--control-adjustment-ink", "--control-adjustment-boundary", "--control-field-bg", "--control-field-ink",
      "--control-field-boundary", "--control-focus-outline"]) {
      if (!value(name)) errors.push(`${name} missing`);
    }
    for (const [alias, target] of [["--control-primary-bg", "--cta"], ["--control-primary-ink", "--cta-ink"],
      ["--control-primary-disabled-bg", "--rule"], ["--control-primary-disabled-ink", "--ink-soft"],
      ["--control-secondary-bg", "--surface"], ["--control-secondary-boundary", "--boundary-required"],
      ["--control-destructive-ink", "--danger"],
      ["--control-destructive-boundary", "--boundary-required"], ["--control-disclosure-ink", "--ink"],
      ["--control-selection-bg", "--surface"], ["--control-selection-boundary", "--boundary-required"],
      ["--control-selection-active-bg", "--entry-tint"], ["--control-adjustment-bg", "--control-secondary-bg"],
      ["--control-adjustment-ink", "--control-secondary-ink"], ["--control-adjustment-boundary", "--control-secondary-boundary"],
      ["--control-field-bg", "--surface"], ["--control-field-ink", "--ink"],
      ["--control-field-boundary", "--boundary-required"], ["--control-selected-boundary", "--boundary-selected"],
      ["--control-error-boundary", "--color-destructive"], ["--color-focus", "--accent"]]) {
      if (value(alias) !== value(target)) errors.push(`${alias} no longer resolves to ${target}`);
    }
    if (!value("--control-focus-outline").includes("2px solid")) errors.push("focus outline lost its 2px reference area");
    return { errors, shadow: value("--elevation-modal-shadow"), language: value("--font-language"), data: value("--font-training-data") };
  });
  for (const theme of ["light", "dark"]) {
    await opened.page.evaluate((next) => document.documentElement.setAttribute("data-theme", next), theme);
    const contract = await tokenContract();
    assert.deepEqual(contract.errors, [], `${theme} semantic token values resolve and retired aliases stay absent`);
    assert.match(contract.language, /Plex Sans/, "language family remains Plex Sans");
    assert.match(contract.data, /Plex Mono/, "training data family remains Plex Mono");
    assert.match(contract.shadow, theme === "dark" ? /rgba\(0,0,0/ : /rgba\(27,26,23/,
      `${theme} depth uses the proper shadow channels`);
    const landingColors = await opened.page.evaluate(() => {
      const sample = document.createElement("span");
      document.body.append(sample);
      const resolve = (token) => {
        sample.style.backgroundColor = `var(${token})`;
        return getComputedStyle(sample).backgroundColor;
      };
      const colors = Object.fromEntries([
        "--color-action-text", "--color-action-on-fill", "--color-ink", "--color-focus",
        "--color-disabled-reason", "--bg", "--well", "--surface", "--control-primary-disabled-bg",
        "--control-selection-ink", "--control-selection-boundary",
        "--band-night-bg", "--band-night-raised", "--band-night-ink", "--band-night-ink-soft", "--band-night-ink-faint",
        "--band-night-accent", "--band-night-boundary-required", "--band-night-cta-bg", "--band-night-cta-ink",
        "--band-orange-bg", "--band-orange-ink", "--band-orange-cta-ink", "--band-orange-cta-mark",
        "--band-ink-bg", "--band-ink-ink",
      ].map((token) => [token, resolve(token)]));
      sample.remove();
      return colors;
    });
    const rgb = (token) => landingColors[token].match(/\d+/g).slice(0, 3).map(Number);
    const ratio = (a, b) => contrastRatio(rgb(a), rgb(b));
    // The final page's bands hold their measured pairs in both appearances (contract: Landing bands, OG-3).
    assert.ok(ratio("--band-night-cta-ink", "--band-night-cta-bg") >= 4.5, `${theme} night creation pill label has AA contrast`);
    assert.ok(ratio("--band-night-cta-bg", "--band-night-bg") >= 3, `${theme} night creation pill is distinct from the night band`);
    assert.ok(ratio("--band-orange-cta-ink", "--band-orange-ink") >= 4.5, `${theme} orange-band creation pill label has AA contrast`);
    assert.ok(ratio("--band-orange-cta-mark", "--band-orange-ink") >= 3, `${theme} orange-band creation arrow has 3:1 on the pill`);
    assert.ok(ratio("--band-orange-ink", "--band-orange-bg") >= 4.5, `${theme} text on the orange band has AA contrast`);
    assert.ok(ratio("--band-orange-ink", "--band-orange-bg") >= 3, `${theme} the orange-band pill is distinct from the orange field`);
    assert.ok(ratio("--band-night-ink", "--band-night-bg") >= 4.5 && ratio("--band-night-ink-soft", "--band-night-raised") >= 4.5 &&
      ratio("--band-night-ink-faint", "--band-night-bg") >= 4.5, `${theme} night-band text has AA contrast on both grounds`);
    assert.ok(ratio("--band-night-boundary-required", "--band-night-raised") >= 3, `${theme} the proof rail's inactive step has 3:1 on the raised night band`);
    assert.ok(ratio("--band-night-accent", "--band-night-raised") >= 3, `${theme} the proof rail's current step has 3:1 on the raised night band`);
    assert.ok(ratio("--band-ink-ink", "--band-ink-bg") >= 4.5, `${theme} text on the ink band has AA contrast`);
    assert.ok(ratio("--color-focus", "--bg") >= 3, `${theme} landing focus ring is visible outside the button`);
    assert.ok(ratio("--color-ink", "--control-primary-disabled-bg") >= 4.5, `${theme} disabled creation label remains readable`);
    assert.ok(ratio("--control-selection-ink", "--surface") >= 4.5, `${theme} Include and Avoid default labels have AA contrast`);
    assert.ok(ratio("--control-selection-ink", "--well") >= 4.5, `${theme} Include and Avoid hover labels have AA contrast`);
    assert.ok(ratio("--control-selection-boundary", "--surface") >= 3, `${theme} preference selection boundary is visible`);
    assert.ok(ratio("--color-focus", "--surface") >= 3, `${theme} preference focus outline is visible`);
    assert.ok(ratio("--color-disabled-reason", "--surface") >= 4.5, `${theme} disabled preference explanation remains readable`);

    for (const [width, expectedStage, expectedCrop] of [[390, 24, 14], [340, 20, 14], [320, 20, 14]]) {
      await opened.page.setViewportSize({ width, height: 844 });
      await opened.page.waitForTimeout(250);
      const radii = await opened.page.evaluate(() => ({
        stages: [...document.querySelectorAll(".firstrun-proof__glass")].map((stage) => getComputedStyle(stage).borderTopLeftRadius),
        crops: [...document.querySelectorAll(".firstrun-step__crop")].map((crop) => getComputedStyle(crop).borderTopLeftRadius),
      }));
      assert.ok(radii.stages.length > 0, `${theme} landing has a pinned phone plate at ${width}px`);
      assert.ok(radii.crops.length > 0, `${theme} landing has step crops at ${width}px`);
      assert.ok(radii.stages.every((radius) => radius === `${expectedStage}px`),
        `${theme} phone plate keeps ${expectedStage}px at ${width}px: ${JSON.stringify(radii)}`);
      assert.ok(radii.crops.every((radius) => radius === `${expectedCrop}px`),
        `${theme} step crop keeps ${expectedCrop}px at ${width}px: ${JSON.stringify(radii)}`);
    }
    await opened.page.setViewportSize({ width: 390, height: 844 });
    await opened.page.waitForTimeout(250);
    const typography = await opened.page.evaluate(() => ({
      prose: getComputedStyle(document.querySelector(".firstrun-step__text")).fontFamily,
      data: getComputedStyle(document.querySelector(".firstrun-oc__n")).fontFamily,
      proofData: getComputedStyle(document.querySelector(".firstrun-step__value")).fontFamily,
    }));
    assert.match(typography.prose, /Plex Sans/, `${theme} ordinary landing prose uses the language font`);
    assert.match(typography.data, /Plex Mono/, `${theme} the next targets keep Mono`);
    assert.match(typography.proofData, /Plex Mono/, `${theme} the proof's result keeps Mono`);

    const cdp = await opened.context.newCDPSession(opened.page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#firstRunImport" });
    assert.ok(nodeId, "landing Import control is present for pressed-state proof");
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["active"] });
    const pressedImport = await opened.page.locator("#firstRunImport").evaluate((button) => {
      const style = getComputedStyle(button);
      return { decoration: style.textDecorationColor, ink: style.color, background: style.backgroundColor, line: style.textDecorationLine, border: style.borderTopWidth };
    });
    assert.equal(pressedImport.decoration, pressedImport.ink, `${theme} Track press draws its underline in full ink`);
    assert.equal(pressedImport.background, "rgba(0, 0, 0, 0)", `${theme} Track is a text link: no fill`);
    assert.match(pressedImport.line, /underline/, `${theme} Track stays underlined`);
    assert.equal(pressedImport.border, "0px", `${theme} Track has no boundary of its own`);
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
    await cdp.detach();
  }
  await opened.page.evaluate(() => document.documentElement.style.setProperty("--r", "var(--radius-control)"));
  assert.ok((await tokenContract()).errors.some((error) => error.includes("--r must remain absent")), "a retired compatibility alias cannot be reintroduced");
  await opened.page.evaluate(() => {
    document.documentElement.style.removeProperty("--r");
    document.documentElement.style.setProperty("--radius-landing-crop", "16px");
  });
  assert.ok((await tokenContract()).errors.some((error) => error.includes("--radius-landing-crop")), "flattening the crop's rendered token is rejected");
  await opened.page.evaluate(() => {
    document.documentElement.style.removeProperty("--radius-landing-crop");
    document.documentElement.setAttribute("data-theme", "light");
  });
  const real = await opened.page.evaluate(measureRenderedRoles, [{ selector: "#firstRunCreate", kind: "text" }]);
  assert.equal(real[0].status, "pass", `actual landing CTA has compliant rendered label: ${JSON.stringify(real)}`);
  const realLink = await opened.page.evaluate(measureRenderedRoles, [{ selector: "#firstRunImport", kind: "text" }, { selector: "#firstRunPrivacy", kind: "text" }]);
  assert.ok(realLink.every((item) => item.status === "pass"), `actual landing Track and Privacy labels are compliant: ${JSON.stringify(realLink)}`);
  const wrongExceptionStates = inventory.exceptions.map((item) => item.selector === ".firstrun__logo"
    ? { ...item, catalogStates: ["settings/main"] } : item);
  const exceptionCoverage = await opened.page.evaluate(inspectRoleCoverage, {
    key: "onboarding-start/first-run", components: inventory.components,
    exceptions: wrongExceptionStates, progressCandidateSelectors: inventory.progressCandidateSelectors,
  });
  assert.ok(exceptionCoverage.problems.some((item) => item.includes("uses exception .firstrun__logo outside its catalog states")),
    "an exception cannot cover a state it does not own");
  await opened.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `
    <div id="uiSystemFaults" style="position:fixed;top:100px;left:20px;background:#fff;padding:8px;z-index:999">
      <p id="uiBadText" style="font-size:16px;color:#808080;background:#fff">Bad body text</p>
      <span id="uiBadIcon" style="display:block;width:24px;height:24px;background:#aaa;mask:linear-gradient(#000,#000)"></span>
      <button id="uiBadBoundary" style="display:block;border:1px solid #ddd;background:#fff;color:#111">Boundary</button>
      <button id="uiDecorativeSide" style="display:block;border:0;border-bottom:1px solid var(--boundary-decorative);border-left:3px solid #111;background:#fff;color:#111">Required edge</button>
      <button id="uiBadFocus" style="display:block;outline:2px solid #ddd;background:#fff;color:#111">Focus</button>
      <button id="uiDuplicateFocus" style="display:block;background:#fff;color:#111">First duplicate</button>
      <button id="uiDuplicateFocus" style="display:block;background:#fff;color:#111">Second duplicate</button>
      <button id="uiThinFocus" style="display:block;outline:1px solid #111;background:#fff;color:#111">Thin focus</button>
      <svg style="display:block;width:48px;height:48px"><circle id="uiBadArc" cx="24" cy="24" r="18" fill="none" stroke="#ddd" stroke-width="6" /></svg>
      <style>#uiDuplicateFocus:focus-visible{outline:2px solid #111}</style>
      <p id="uiUnsupported" style="background:linear-gradient(#fff,#eee);color:#333">Gradient</p>
      <button id="uiDisabled" disabled style="color:#aaa;background:#fff">Unavailable</button>
      <p id="uiDisabledReason" style="color:#808080;background:#fff">Why unavailable</p>
      <div style="opacity:0"><span id="uiTransparentText">Closed layer</span></div>
    </div>`));
  const measured = await opened.page.evaluate(measureRenderedRoles, [
    { selector: "#uiBadText", kind: "text" }, { selector: "#uiBadIcon", kind: "icon" },
    { selector: "#uiBadArc", kind: "boundary" },
    { selector: "#uiBadBoundary", kind: "boundary" }, { selector: "#uiBadFocus", kind: "focus" },
    { selector: "#uiDecorativeSide", kind: "boundary" },
    { selector: "#uiThinFocus", kind: "focus" },
    { selector: "#uiUnsupported", kind: "text" }, { selector: "#uiDisabled", kind: "disabled-control" },
    { selector: "#uiDisabledReason", kind: "disabled-reason" },
  ]);
  for (const selector of ["#uiBadText", "#uiBadIcon", "#uiBadArc", "#uiBadBoundary", "#uiBadFocus", "#uiThinFocus", "#uiDisabledReason"]) {
    assert.equal(measured.find((item) => item.selector === selector)?.status, "fail", `${selector} deliberate rendered-role failure is rejected: ${JSON.stringify(measured)}`);
  }
  assert.equal(measured.find((item) => item.selector === "#uiUnsupported")?.status, "unsupported", "unresolved effective background blocks rather than passing");
  assert.equal(measured.find((item) => item.selector === "#uiDecorativeSide")?.status, "pass",
    `a decorative separator cannot fail a separate required control edge: ${JSON.stringify(measured)}`);
  assert.equal(measured.find((item) => item.selector === "#uiDisabled")?.status, "exempt", "disabled control mass is exempt without exempting its reason");
  const visibleMeasurements = await opened.page.evaluate(measureRenderedRoles, { components: [] });
  assert.ok(!visibleMeasurements.some((item) => item.selector === "text:#uiTransparentText"),
    "fully transparent content is not treated as a live rendered role");
  const duplicateFocus = await auditFocusRoles(opened.page, {
    key: "onboarding-start/first-run [duplicate-id fixture]",
    components: [{ selector: "#uiDuplicateFocus", roles: { control: "secondary" }, states: ["focus-visible"] }],
    pixels: (await opened.page.screenshot({ animations: "disabled" })).toString("base64"),
  });
  assert.equal(duplicateFocus.measurements.total, 2, "duplicate-ID controls each receive an independent focus measurement");
  assert.equal(duplicateFocus.measurements.pass, 2, `both duplicate-ID focus outlines are measured: ${JSON.stringify(duplicateFocus)}`);
  // A control in a fixed layer that paints nothing floats over a band outside its DOM
  // ancestry (the landing dock). Its outline is read against the rendered band, not the
  // light page behind the layer: an ink outline over an ink band fails although the page
  // walk would pass it, and a paper outline over the same band passes although the page
  // walk would fail it.
  await opened.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `
    <div id="uiFloatBand" style="position:fixed;top:300px;left:0;width:360px;height:160px;background:#141310;z-index:1000"></div>
    <div id="uiFloatLayer" style="position:fixed;top:330px;left:30px;width:300px;z-index:1001">
      <button id="uiFloatInk" style="display:block;width:240px;height:40px;outline:2px solid #141310;outline-offset:3px;background:#F2EFE9;color:#141310">Ink ring</button>
      <button id="uiFloatPaper" style="display:block;margin-top:24px;width:240px;height:40px;outline:2px solid #F2EFE9;outline-offset:3px;background:#141310;color:#F2EFE9">Paper ring</button>
    </div>`));
  const floatPixels = (await opened.page.screenshot({ animations: "disabled" })).toString("base64");
  const floating = await opened.page.evaluate(measureRenderedRoles, { pixels: floatPixels, requests: [
    { selector: "#uiFloatInk", kind: "focus" }, { selector: "#uiFloatPaper", kind: "focus" },
  ] });
  assert.equal(floating.find((item) => item.selector === "#uiFloatInk")?.status, "fail",
    `an ink outline over an ink band beneath a bare fixed layer is rejected: ${JSON.stringify(floating)}`);
  assert.equal(floating.find((item) => item.selector === "#uiFloatPaper")?.status, "pass",
    `a paper outline over an ink band beneath a bare fixed layer reads against that band: ${JSON.stringify(floating)}`);
  await opened.page.evaluate(() => { document.querySelector("#uiFloatBand")?.remove(); document.querySelector("#uiFloatLayer")?.remove(); });
  const auditProblems = renderedRoleProblems("onboarding-start/first-run [en/light]", [
    ...measured,
    { selector: "#uiMissing", kind: "boundary", status: "missing" },
  ]);
  assert.ok(auditProblems.some((item) => item.includes("#uiBadText fail")), "the catalog audit turns low rendered text contrast into a blocking finding");
  assert.ok(auditProblems.some((item) => item.includes("#uiBadArc fail")), "the catalog audit rejects a low-contrast SVG boundary stroke");
  assert.ok(auditProblems.some((item) => item.includes("#uiUnsupported unsupported")), "the catalog audit blocks unresolved rendered backgrounds");
  assert.ok(auditProblems.some((item) => item.includes("#uiMissing missing")), "the catalog audit blocks a missing required role measurement");
  assert.ok(!auditProblems.some((item) => item.includes("disabled-control #uiDisabled")), "an inactive control exemption does not become a catalog failure");
  await opened.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `
    <div id="uiRadioContexts" style="position:fixed;top:180px;left:20px;z-index:1000">
      <div class="onb__opts onb__list" style="display:block;width:220px;padding:8px;background:#fff;border:2px solid #6e6a63">
        <button class="radio-card" id="uiRadioGood" style="display:flex;border:0;background:transparent;color:#111">
          <span class="radio-card__mark" style="display:block;width:16px;height:16px;border:2px solid #6e6a63;background:#fff"></span>Good choice
        </button>
        <button class="radio-card" id="uiRadioBad" style="display:flex;border:0;background:transparent;color:#111">
          <span class="radio-card__mark" style="display:block;width:16px;height:16px;border:2px solid #ddd;background:#fff"></span>Bad choice
        </button>
      </div>
      <button id="uiSelectedMark" aria-pressed="true" style="position:relative;display:block;width:60px;height:32px;background:#fff;color:#111">
        <span>Selected</span>
      </button>
      <button id="uiRequiredSelectedMark" aria-pressed="true" style="position:relative;display:block;width:60px;height:32px;border:2px solid #111;background:#fff;color:#111">
        <span>Selected with required boundary</span>
      </button>
      <button id="uiPseudoGood" role="checkbox" aria-checked="false" style="display:block;width:44px;height:32px;border:0;background:transparent"></button>
      <button id="uiPseudoBad" role="checkbox" aria-checked="false" style="display:block;width:44px;height:32px;border:0;background:transparent"></button>
      <style>
        #uiSelectedMark::before,#uiRequiredSelectedMark::before{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:#111}
        #uiPseudoGood::before,#uiPseudoBad::before{content:"";display:inline-block;width:16px;height:16px;border-radius:50%}
        #uiPseudoGood::before{border:2px solid #6e6a63}
        #uiPseudoBad::before{border:2px solid #ddd}
      </style>
    </div>`));
  const contextualRoles = await opened.page.evaluate(measureRenderedRoles, { components: [
    { selector: ".radio-card", roles: { control: "selection", boundary: "required" } },
    { selector: "#uiSelectedMark", roles: { control: "selection" } },
    { selector: "#uiRequiredSelectedMark", roles: { control: "selection", boundary: "required" } },
    { selector: "#uiPseudoGood", roles: { control: "selection", boundary: "required" } },
    { selector: "#uiPseudoBad", roles: { control: "selection", boundary: "required" } },
  ] });
  const groupedMarks = contextualRoles.filter((item) => item.selector.includes("radio-card__mark"));
  assert.deepEqual(groupedMarks.map((item) => item.status).sort(), ["fail", "pass"],
    `grouped choices measure their actual marks without treating transparent rows as boundaries: ${JSON.stringify(contextualRoles)}`);
  assert.ok(contextualRoles.some((item) => item.kind === "boundary" && item.selector.includes("onb__opts.onb__list") && item.status === "pass"),
    "the grouped choice boundary is measured at its visible owner");
  assert.equal(contextualRoles.find((item) => item.selector.includes("#uiPseudoGood") && item.kind === "boundary")?.status, "pass",
    `required pseudo-element boundaries use their rendered border: ${JSON.stringify(contextualRoles)}`);
  assert.equal(contextualRoles.find((item) => item.selector.includes("#uiPseudoBad") && item.kind === "boundary")?.status, "fail",
    `a low-contrast pseudo-element boundary remains a deliberate rendered-role failure: ${JSON.stringify(contextualRoles)}`);
  assert.equal(contextualRoles.find((item) => item.kind === "state-mark" && item.selector.includes("uiSelectedMark"))?.status, "pass",
    "selected state measures its visible stripe rather than its quiet background wash");
  assert.equal(contextualRoles.find((item) => item.kind === "state-mark" && item.selector.includes("uiRequiredSelectedMark"))?.status, "pass",
    "a required control boundary does not suppress selected state-mark contrast");
  await opened.page.evaluate(() => document.querySelector("#uiSystemFaults")?.remove());
  // A heading is read whole (R7 V-05): a line clamp that cuts one short fails the audit; one that only reserves room does not.
  await opened.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `
    <div id="uiClampFixtures" style="position:fixed;top:60px;left:20px;width:90px;background:#fff;z-index:999">
      <h2 id="uiClampCut" style="margin:0;font-size:16px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">A long day title that needs many lines</h2>
      <div id="uiClampRole" role="heading" aria-level="2" style="margin:0;font-size:16px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden">Another long heading in a role</div>
      <h2 id="uiClampRoom" style="margin:0;font-size:16px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden">Short</h2>
      <h2 id="uiClampNone" style="margin:0;font-size:16px">A heading with no clamp wraps in full</h2>
    </div>`));
  const clampFindings = await opened.page.evaluate(measureClampedHeadings);
  const clampStatus = (id) => clampFindings.find((item) => item.selector.startsWith(`#${id}:`))?.status;
  assert.equal(clampStatus("uiClampCut"), "fail", `a clamp that cuts a heading short fails: ${JSON.stringify(clampFindings)}`);
  assert.equal(clampStatus("uiClampRole"), "fail", "a role=heading element is held to the same rule");
  assert.equal(clampStatus("uiClampRoom"), "pass", "a clamp that cuts nothing passes");
  assert.equal(clampStatus("uiClampNone"), undefined, "an unclamped heading is not a clamp finding");
  assert.equal(renderedRoleProblems("fixture", clampFindings).length, 2, "exactly the two cut headings become audit problems");
  assert.match(renderedRoleProblems("fixture", clampFindings)[0], /-webkit-line-clamp 2 cuts the heading short/, "the finding names the clamp and the cut");
  await opened.page.evaluate(() => document.querySelector("#uiClampFixtures")?.remove());
  await opened.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `
    <div id="uiSystemFaults" style="position:fixed;top:100px;left:20px;background:#fff;z-index:999">
      <button id="uiUnmapped">Unmapped</button>
      <button id="uiWrongIntent" data-action-role="removal">Remove</button>
      <div id="uiOuter" style="width:100px;height:100px;box-shadow:0 3px 8px #555">
        <div id="uiInner" style="width:50px;height:50px;box-shadow:0 2px 4px #555"></div>
      </div>
      <div id="uiMissingProgress" class="segbar" style="width:100px;height:10px"></div>
      <progress id="uiNativeProgress" max="3" value="1" style="width:100px;height:10px"></progress>
    </div>`));
  const fixtureComponent = (selector, roles) => ({ id: selector, selector, roles, catalogStates: ["onboarding-start/first-run"] });
  const coverage = await opened.page.evaluate(inspectRoleCoverage, {
    key: "onboarding-start/first-run", components: [
      ...inventory.components,
      fixtureComponent("#uiOuter", { elevation: "flat" }),
      fixtureComponent("#uiInner", { elevation: "flat" }),
      fixtureComponent("#uiWrongIntent", { control: "secondary" }),
      { ...fixtureComponent("#uiMissingProgress", { progress: "task" }), progressScopes: { "entry-route-step": "task" } },
    ], exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors,
  });
  assert.ok(coverage.problems.some((item) => item.includes("#uiUnmapped has no inventory role")), "visible control without a role fails");
  assert.ok(coverage.problems.some((item) => item.includes("#uiWrongIntent removal action is secondary, expected destructive")),
    "same-looking Replace and Remove actions cannot share a semantic role");
  assert.ok(coverage.problems.some((item) => item.includes("#uiInner creates nested elevation")), "nested outward shadows fail");
  assert.ok(coverage.problems.some((item) => item.includes("#uiMissingProgress progress needs declared dimension/scope")), "missing progress dimension fails");
  assert.ok(coverage.problems.some((item) => item.includes("#uiNativeProgress has no inventory role")),
    "a new native progress mark cannot evade the inventory selector list");
  await opened.page.evaluate(() => {
    const node = document.querySelector("#uiMissingProgress");
    node.dataset.progressDimension = "task";
    node.dataset.progressScope = "invented-scope";
  });
  const wrongScope = await opened.page.evaluate(inspectRoleCoverage, {
    key: "onboarding-start/first-run", components: [
      ...inventory.components,
      { ...fixtureComponent("#uiMissingProgress", { progress: "task" }), progressScopes: { "entry-route-step": "task" } },
    ], exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors,
  });
  assert.ok(wrongScope.problems.some((item) => item.includes("#uiMissingProgress progress needs declared dimension/scope")),
    "an invented scope fails even when its dimension is valid");
  const ambiguousRendered = await opened.page.evaluate(inspectRoleCoverage, {
    key: "onboarding-start/first-run", components: [
      ...inventory.components,
      fixtureComponent("#uiUnmapped", { control: "secondary" }),
      fixtureComponent("button#uiUnmapped", { control: "destructive" }),
    ], exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors,
    allowProgressDebt: true,
  });
  assert.ok(ambiguousRendered.problems.some((item) => item.includes("#uiUnmapped ambiguous roles")), "overlapping selectors fail instead of guessing by order");
  const preferenceCapture = { ...capture, flow: "onboarding-custom", screen: "exercise-preferences" };
  const preferencePage = await openPage(browser, manifest, preferenceCapture, onboardingState("onboarding-custom/exercise-preferences", "en"));
  try {
    await ONBOARDING_SCENARIOS["onboarding-custom/exercise-preferences"](preferencePage.page);
    const initial = await preferencePage.page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".entry__exercise-action:not([id])")];
      return { statuses: [...new Set(buttons.map((button) => button.dataset.entryExerciseStatus))].sort(),
        selectedButtons: buttons.filter((button) => button.matches("[aria-pressed='true'],[aria-selected='true'],[aria-checked='true'],.is-selected")).length,
        accessibleNames: buttons.map((button) => button.getAttribute("aria-label")),
        visibleNames: buttons.map((button) => button.textContent.trim()),
        exerciseNames: buttons.map((button) => button.closest(".entry__exercise-result")?.querySelector(".entry__exercise-name")?.textContent || ""),
        targetHeights: buttons.map((button) => button.getBoundingClientRect().height),
        includeList: document.querySelector("#entryIncludeListLabel")?.textContent,
        avoidList: document.querySelector("#entryAvoidListLabel")?.textContent };
    });
    assert.deepEqual(initial.statuses, ["avoid", "include"], "one production search result offers both reversible choices");
    assert.equal(initial.selectedButtons, 0, "selected preferences live in lists, not on the search-result buttons");
    assert.ok(initial.accessibleNames.every((name, index) => name === `${initial.visibleNames[index]} ${initial.exerciseNames[index]}`),
      "Include and Avoid controls name their exercise in the accessible label");
    assert.ok(initial.targetHeights.every((height) => height >= 44), "Include and Avoid keep the shared 44px target");
    assert.equal(initial.includeList, "Include");
    assert.equal(initial.avoidList, "Avoid");
    const cdp = await preferencePage.context.newCDPSession(preferencePage.page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    for (const action of ["include", "avoid"]) {
      const selector = `.entry__exercise-action[data-entry-exercise-status="${action}"]`;
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      assert.ok(nodeId, `${action} result control is present for pressed-state proof`);
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["active"] });
      const pressed = await preferencePage.page.locator(selector).first().evaluate((button) => {
        const resolve = (token, property) => {
          const probe = document.createElement("span");
          probe.style.setProperty(property, `var(${token})`);
          document.body.append(probe);
          const value = getComputedStyle(probe).getPropertyValue(property);
          probe.remove();
          return value;
        };
        return {
          background: getComputedStyle(button).backgroundColor,
          ink: getComputedStyle(button).color,
          boundary: getComputedStyle(button).borderTopColor,
          expectedWell: resolve("--well", "background-color"),
          expectedInk: resolve("--control-selection-ink", "color"),
          expectedBoundary: resolve("--control-selection-boundary", "color"),
        };
      });
      assert.equal(pressed.background, pressed.expectedWell, `${action} press retains the hover paper`);
      assert.equal(pressed.ink, pressed.expectedInk, `${action} press retains selection ink`);
      assert.equal(pressed.boundary, pressed.expectedBoundary, `${action} press retains the required selection boundary`);
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
    }
    await cdp.detach();
    const preferenceCoverage = await preferencePage.page.evaluate(inspectRoleCoverage, {
      key: "onboarding-custom/exercise-preferences", components: inventory.components,
      exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors,
      allowProgressDebt: true,
    });
    assert.ok(preferenceCoverage.matched.includes("entry-exercise-action-not-id"), "the rendered pair matches its exact inventory owner");
    assert.equal(preferenceCoverage.problems.length, 0, `exercise-preference state has no ambiguous owner: ${preferenceCoverage.problems.join("; ")}`);
    const includeRow = preferencePage.page.locator(".entry__exercise-result").first();
    const includedName = await includeRow.locator(".entry__exercise-name").textContent();
    await includeRow.locator('[data-entry-exercise-status="include"]').click();
    await preferencePage.page.waitForFunction((name) =>
      document.querySelector("#entryIncludeListLabel")?.parentElement?.textContent?.includes(name), includedName);
    assert.equal(await preferencePage.page.locator(`.entry__exercise-result:has-text("${includedName}")`).count(), 0,
      "Include moves the exercise into its named list instead of selecting its search button");
    const avoidRow = preferencePage.page.locator(".entry__exercise-result").first();
    const avoidedName = await avoidRow.locator(".entry__exercise-name").textContent();
    await avoidRow.locator('[data-entry-exercise-status="avoid"]').click();
    assert.equal(await preferencePage.page.locator(".entry__avoid-pending").count(), 1,
      "Avoid opens the required reason before committing an exclusion");
    await preferencePage.page.locator('.entry__avoid-pending [data-entry-pick="avoidReason"]').first().click();
    await preferencePage.page.waitForFunction((name) =>
      document.querySelector("#entryAvoidListLabel")?.parentElement?.querySelector(".entry__avoid-list")?.textContent?.includes(name), avoidedName);
    assert.equal(await preferencePage.page.locator(".entry__avoid-pending").count(), 0,
      "the chosen reason commits an Avoid preference into its named list");
  } finally { await preferencePage.context.close(); }
  const ptPreferencePage = await openPage(browser, manifest, preferenceCapture, onboardingState("onboarding-custom/exercise-preferences", "pt"));
  try {
    await ONBOARDING_SCENARIOS["onboarding-custom/exercise-preferences"](ptPreferencePage.page);
    const localizedNames = await ptPreferencePage.page.locator(".entry__exercise-action:not([id])").evaluateAll((buttons) => buttons.map((button) => ({
      name: button.getAttribute("aria-label"), label: button.textContent.trim(),
      exercise: button.closest(".entry__exercise-result")?.querySelector(".entry__exercise-name")?.textContent || "",
    })));
    assert.ok(localizedNames.every(({ name, label, exercise }) => name === `${label} ${exercise}`),
      "Portuguese Include and Avoid controls name their exercise in the accessible label");
  } finally { await ptPreferencePage.context.close(); }
  for (const { selector, mode, subview } of [
    { selector: "#entryFreeformStart", mode: "freeform", subview: "#entryFreeformIn" },
    { selector: '[data-entry-route="import"]', mode: "file", subview: "#entryImportPick" },
  ]) {
    const hubCapture = { ...capture, screen: "hub-own-open" };
    const hubPage = await openPage(browser, manifest, hubCapture, onboardingState("onboarding-start/hub-own-open", "en"));
    try {
      await ONBOARDING_SCENARIOS["onboarding-start/hub-own-open"](hubPage.page);
      const hub = await hubPage.page.evaluate(() => {
        const doors = [document.querySelector("#entryFreeformStart"), document.querySelector('[data-entry-route="import"]')];
        return {
          present: doors.every(Boolean),
          selected: doors.some((door) => door?.matches("[aria-selected='true'],[aria-checked='true'],[aria-pressed='true'],[aria-current],.is-selected,.is-active")),
        };
      });
      assert.equal(hub.present, true, "both import doors render together on the own-program hub");
      assert.equal(hub.selected, false, "neither hub door advertises a selected source");
      const coverage = await hubPage.page.evaluate(inspectRoleCoverage, {
        key: "onboarding-start/hub-own-open", components: inventory.components,
        exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors,
        allowProgressDebt: true,
      });
      assert.ok(coverage.matched.includes("entryfreeformstart") && coverage.matched.includes("entry-card-entry-card-secondary-not-id"),
        "both rendered import doors reach their distinct inventory selectors");
      assert.deepEqual(coverage.problems, [], "the hub has no ambiguous semantic owners");
      await hubPage.page.click(selector);
      await hubPage.page.waitForSelector(`#onbBody.entry-route--import ${subview}`, { timeout: 20000 });
      const entered = await hubPage.page.evaluate(() => ({
        mode: JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").importSourceMode,
        route: document.querySelector("#onbBody")?.classList.contains("entry-route--import"),
        hubVisible: !!document.querySelector("#entryFreeformStart"),
      }));
      assert.deepEqual(entered, { mode, route: true, hubVisible: false },
        `${selector} enters import with its named device-only source and leaves the hub`);
      await hubPage.page.click("#onbBack");
      await hubPage.page.waitForSelector("#entryOwnToggle", { timeout: 20000 });
      await hubPage.page.click("#entryOwnToggle");
      const returnedDoors = await hubPage.page.locator("#entryFreeformStart, [data-entry-route=import]").evaluateAll((doors) => ({
        count: doors.length,
        selected: doors.some((door) => door.matches("[aria-selected='true'],[aria-checked='true'],[aria-pressed='true'],[aria-current],.is-selected,.is-active")),
      }));
      assert.deepEqual(returnedDoors, { count: 2, selected: false },
        `${selector} leaves both hub doors present and unselected after return`);
    } finally { await hubPage.context.close(); }
  }
  for (const sharedCapture of [
    { ...capture, flow: "onboarding-shared", screen: "preview", viewport: "phone-320" },
    { ...capture, flow: "onboarding-shared", screen: "preview", text: "text200" },
  ]) {
    const sharedPage = await openPage(browser, manifest, sharedCapture, onboardingState("onboarding-shared/preview", "en"));
    try {
      await ONBOARDING_SCENARIOS["onboarding-shared/preview"](sharedPage.page);
      const geometry = await sharedPage.page.evaluate(() => {
        const strip = document.querySelector(".entry__strip");
        const metrics = [...document.querySelectorAll(".entry__strip .entry__strip-cell")];
        const rects = metrics.map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            text: node.textContent.trim(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
            scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
        });
        const overlaps = [];
        for (let left = 0; left < rects.length; left++) for (let right = left + 1; right < rects.length; right++) {
          const a = rects[left], b = rects[right];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([a.text, b.text]);
        }
        return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
          stripWidth: strip?.scrollWidth || 0, stripClientWidth: strip?.clientWidth || 0,
          metricCount: metrics.length, overlaps, overflowingMetrics: rects.filter((item) => item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1) };
      });
      assert.equal(geometry.metricCount, 4, `${sharedCapture.viewport}/${sharedCapture.text}: all four shared summary facts render`);
      assert.ok(geometry.document <= geometry.viewport, `${sharedCapture.viewport}/${sharedCapture.text}: no document overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.stripWidth <= geometry.stripClientWidth + 1,
        `${sharedCapture.viewport}/${sharedCapture.text}: summary metrics fit their strip: ${JSON.stringify(geometry)}`);
      assert.deepEqual(geometry.overlaps, [],
        `${sharedCapture.viewport}/${sharedCapture.text}: summary metric rows do not overlap: ${JSON.stringify(geometry)}`);
      assert.deepEqual(geometry.overflowingMetrics, [],
        `${sharedCapture.viewport}/${sharedCapture.text}: summary metric text remains inside each item: ${JSON.stringify(geometry)}`);
    } finally { await sharedPage.context.close(); }
  }
  console.log("ui-system: exact import-door and import-subview contracts, preference and radius contracts, shared-preview responsive metrics, live ownership, AA failures, and deliberate contract negatives passed");
} finally { await context?.close(); await browser.close(); preview.cleanup(); }
