#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ROOT, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { loadRoleInventory, validateRoleInventory, cssLiteralDebt, contrastRatio } from "../tools/ui-system-core.mjs";
import { measureRenderedRoles } from "../tools/ui-system-rendered.mjs";
import { inspectRoleCoverage } from "../tools/check-ui-system.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
import { onboardingState, ONBOARDING_SCENARIOS } from "../tools/ui-screens/screens-onboarding.mjs";

const manifest = loadManifest(), inventory = loadRoleInventory();
assert.deepEqual(validateRoleInventory(inventory, manifest), [], "current manifest and semantic inventory agree");
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
const broadException = structuredClone(inventory);
broadException.exceptions.push({ ...inventory.exceptions[0], selector: "body *" });
assert.ok(validateRoleInventory(broadException, manifest).some((error) => error.startsWith("exception body * needs")),
  "a subtree wildcard cannot exempt unknown controls");
const tagException = structuredClone(inventory);
tagException.exceptions.push({ ...inventory.exceptions[0], selector: "body button" });
assert.ok(validateRoleInventory(tagException, manifest).some((error) => error.startsWith("exception body button needs")),
  "a tag-wide exception cannot exempt every button");

const css = readFileSync(join(ROOT, "styles.css"), "utf8");
assert.ok(cssLiteralDebt(css, inventory.exceptions).length > 0, "pre-migration literal debt remains visible");
for (const declaration of ["font-size:15px", "border-radius:11px", "box-shadow:0 2px 8px #777", "color:#808080", "border:1px solid #ccc", "background:red"]) {
  const bad = `.seeded { ${declaration}; }`;
  assert.equal(cssLiteralDebt(bad).length, 1, `checker rejects seeded ${declaration} outside token definitions`);
}
assert.equal(cssLiteralDebt(":root { --font-body:1rem; --radius-control:8px; --ink:#1B1A17; }").length, 0,
  "token definitions are the one place values are declared");
assert.equal(cssLiteralDebt(".art { border-radius:50%; font-size:0; } .square { border-radius:0; }").length, 0,
  "intrinsic circles, squares and glyph-free icon boxes are not migration debt");
assert.equal(cssLiteralDebt(".settings-identity__mark { background:#eee; }", inventory.exceptions).length, 1,
  "a documented artwork exception cannot hide a different color at the same selector");
const invalidState = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--state", "missing/state"], { cwd: ROOT, encoding: "utf8" });
assert.equal(invalidState.status, 1, "a misspelled catalog state cannot make the checker pass on zero renders");
assert.match(invalidState.stderr, /unknown catalog state missing\/state/);
const fixtureDir = mkdtempSync(join(tmpdir(), "taurifer-ui-literal-"));
try {
  const fixture = join(fixtureDir, "bad.css");
  writeFileSync(fixture, ".seeded { font-size:15px; }");
  const rejected = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(rejected.status, 1, "actual checker rejects an isolated literal artifact");
  assert.match(rejected.stderr, /unapproved CSS literals/, "checker names the violation");
  writeFileSync(fixture, ".seeded { font-size:var(--font-size-body); }");
  const repaired = spawnSync(process.execPath, ["tools/check-ui-system.mjs", "--metadata", "--strict-css", "--css", fixture], { cwd: ROOT, encoding: "utf8" });
  assert.equal(repaired.status, 0, "same checker accepts the repaired token declaration");
} finally { rmSync(fixtureDir, { recursive: true, force: true }); }
assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21, "WCAG contrast oracle handles black/white");
assert.ok(contrastRatio([128, 128, 128], [255, 255, 255]) < 4.5, "3.95:1 body text is below AA");
const roleOf = (selector) => inventory.components.find((item) => item.selector === selector)?.roles.control;
assert.equal(roleOf(".program-editor__replace:not([id])"), "secondary", "Replace is a reversible identity edit");
assert.equal(roleOf(".program-editor__remove:not([id])"), "destructive", "Remove discards an exercise");
assert.equal(roleOf(".entry__exercise-action:not([id])"), "selection", "Avoid is a reversible preference, not Remove");
assert.equal(roleOf(".stepbtn:not([id])"), "adjustment", "rapid workout stepper changes a numeric value");
assert.equal(roleOf('button[data-role="adjust"]'), "adjustment", "deliberate program stepper keeps numeric meaning");
assert.equal(roleOf(".prog-day__head:not([id])"), "disclosure", "Program day chevron expands in place");
assert.equal(roleOf(".prog-ex:not([id])"), "quiet-navigation", "Program exercise row with a chevron drills in");
assert.equal(roleOf("#entryFreeformStartOver"), "destructive", "Start over discards staged work");

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

const radiusRecipe = [
  { selector: ".firstrun-stage", condition: "default", token: "--radius-landing-stage" },
  { selector: ".firstrun-stage--signature-crop", condition: "min-width:341px", token: "--radius-landing-crop" },
  { selector: ".firstrun-stage", condition: "max-width:340px", token: "--radius-landing-stage-compact" },
];
const radiusCatalog = ["onboarding-shared/gate", "onboarding-shared/invalid", "onboarding-start/first-run"];
function radiusContractErrors(candidate) {
  const matches = candidate.contextualVariants.filter((item) => item.id === "landing-device-stage-radius");
  const variant = matches[0];
  if (matches.length !== 1 || variant.selector !== ".firstrun-stage" || variant.role !== "radius:landing-device-stage" ||
      JSON.stringify(variant.catalogStates) !== JSON.stringify(radiusCatalog) ||
      JSON.stringify(variant.radiusRecipes) !== JSON.stringify(radiusRecipe)) return ["landing stage radius scope or recipe changed"];
  return [];
}
assert.equal(inventory.contextualVariants.length, 15, "one exact landing radius recipe raises the variant count from 14 to 15");
assert.deepEqual(radiusContractErrors(inventory), [], "normal stage, compact stage, and reasoning crop retain exact Plan 054 geometry");
const flattenedRadius = structuredClone(inventory);
flattenedRadius.contextualVariants.find((item) => item.id === "landing-device-stage-radius").radiusRecipes[1].token = "--radius-prominent";
assert.ok(radiusContractErrors(flattenedRadius).length, "mapping the crop to prominent is rejected");
const widenedRadius = structuredClone(inventory);
widenedRadius.contextualVariants.find((item) => item.id === "landing-device-stage-radius").selector = ".firstrun *";
assert.ok(radiusContractErrors(widenedRadius).length, "landing radius cannot spread to the whole gate");
const widenedRadiusOwner = structuredClone(inventory);
widenedRadiusOwner.contextualVariants.find((item) => item.id === "landing-device-stage-radius").catalogStates.push("onboarding-shared/preview");
assert.ok(radiusContractErrors(widenedRadiusOwner).length, "stage radius cannot claim the entry preview state");

const landingStates = ["onboarding-shared/invalid", "onboarding-start/first-run"];
const landingRecipes = [
  { id: "landing-accent-primary", role: "primary", boundary: "decorative",
    selectors: ["#firstRunCreate", "#firstRunCreateClose", "#firstRunSharedStart"],
    states: ["onboarding-shared/gate", ...landingStates] },
  { id: "landing-bordered-navigation", role: "quiet-navigation", boundary: "required",
    selectors: ["#firstRunImport", "#firstRunImportClose"], states: landingStates },
];
function landingContractErrors(candidate) {
  const errors = [];
  for (const recipe of landingRecipes) {
    const declarations = candidate.contextualVariants.filter((item) => item.id === recipe.id);
    const variant = declarations[0];
    if (declarations.length !== 1 || variant.role !== recipe.role ||
        JSON.stringify(variant.selector.split(/,\s*/)) !== JSON.stringify(recipe.selectors) ||
        JSON.stringify(variant.catalogStates) !== JSON.stringify(recipe.states)) errors.push(`${recipe.id} declaration`);
    const members = candidate.components.filter((item) => item.variant === recipe.id);
    if (JSON.stringify(members.map((item) => item.selector)) !== JSON.stringify(recipe.selectors)) errors.push(`${recipe.id} exact members`);
    for (const selector of recipe.selectors) {
      const item = candidate.components.find((member) => member.selector === selector);
      const states = selector === "#firstRunSharedStart" ? ["onboarding-shared/gate"] : landingStates;
      if (!item || item.roles.control !== recipe.role || item.roles.boundary !== recipe.boundary ||
          JSON.stringify(item.catalogStates) !== JSON.stringify(states) ||
          !item.states.includes("focus-visible") || !item.states.includes("disabled")) errors.push(`${selector} role, boundary, state or catalog owner`);
    }
  }
  return errors;
}
assert.deepEqual(landingContractErrors(inventory), [], "four landing actions and shared Start have two exact recipes and only their rendered states");
const wrongLandingRole = structuredClone(inventory);
wrongLandingRole.components.find((item) => item.selector === "#firstRunImport").roles.control = "secondary";
assert.ok(landingContractErrors(wrongLandingRole).some((error) => error.includes("#firstRunImport")), "visual resemblance cannot silently reclassify import");
const widenedLandingVariant = structuredClone(inventory);
widenedLandingVariant.contextualVariants.find((item) => item.id === "landing-bordered-navigation").selector = ".firstrun__cta--secondary";
assert.ok(landingContractErrors(widenedLandingVariant).includes("landing-bordered-navigation declaration"), "a broad landing selector cannot replace exact IDs");
const wrongLandingOwner = structuredClone(inventory);
wrongLandingOwner.components.find((item) => item.selector === "#firstRunCreateClose").catalogStates.push("onboarding-shared/preview");
assert.ok(landingContractErrors(wrongLandingOwner).some((error) => error.includes("#firstRunCreateClose")), "landing recipe cannot spread into the shared proposal state");

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
      "--font-size-summary-hero": "2.125rem", "--font-size-landing-headline": "2.375rem",
      "--font-size-landing-headline-wide": "3.25rem", "--font-size-landing-climax": "min(4.25rem,16vw)",
      "--font-size-landing-climax-wide": "min(5.5rem,7.5vw)", "--font-size-rest-clock": "clamp(2rem,10vw,2.625rem)",
      "--line-tight": "1.1", "--line-standard": "1.4", "--line-reading": "1.55",
      "--weight-regular": "400", "--weight-medium": "500", "--weight-semibold": "600",
      "--radius-none": "0", "--radius-compact": "4px", "--radius-control": "8px",
      "--radius-surface": "12px", "--radius-prominent": "16px", "--radius-pill": "999px",
      "--radius-round": "50%", "--radius-legacy": "14px",
      "--radius-landing-stage": "24px", "--radius-landing-stage-compact": "20px", "--radius-landing-crop": "14px",
      "--control-target": "44px", "--control-icon-size": "24px", "--control-disabled-opacity": ".4",
    };
    const errors = Object.entries(expected).filter(([name, wanted]) => value(name) !== wanted)
      .map(([name, wanted]) => `${name}: ${value(name)} != ${wanted}`);
    for (const [alias, target] of [["--radius", "--radius-legacy"], ["--r", "--radius-legacy"],
      ["--shadow", "--elevation-flat-shadow"], ["--body", "--font-language"],
      ["--display", "--font-language"], ["--mono", "--font-training-data"],
      ["--font-size-focal-data", "--font-size-feature-title"]]) {
      if (value(alias) !== value(target)) errors.push(`${alias} no longer resolves to ${target}`);
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
    assert.deepEqual(contract.errors, [], `${theme} semantic token values and compatibility aliases resolve`);
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
      ].map((token) => [token, resolve(token)]));
      sample.remove();
      return colors;
    });
    const rgb = (token) => landingColors[token].match(/\d+/g).slice(0, 3).map(Number);
    const ratio = (a, b) => contrastRatio(rgb(a), rgb(b));
    assert.ok(ratio("--color-action-on-fill", "--color-action-text") >= 4.5, `${theme} landing fill label has AA contrast`);
    for (const paper of ["--bg", "--well"]) {
      assert.ok(ratio("--color-ink", paper) >= 4.5, `${theme} landing import label has AA contrast on ${paper}`);
      assert.ok(ratio("--color-action-text", paper) >= 3, `${theme} required import boundary has AA contrast on ${paper}`);
    }
    assert.ok(ratio("--color-focus", "--bg") >= 3, `${theme} landing focus ring is visible outside the button`);
    assert.ok(ratio("--color-ink", "--control-primary-disabled-bg") >= 4.5, `${theme} disabled creation label remains readable`);
    assert.ok(ratio("--color-disabled-reason", "--bg") >= 4.5, `${theme} disabled import label remains readable`);
    assert.ok(ratio("--control-selection-ink", "--surface") >= 4.5, `${theme} Include and Avoid default labels have AA contrast`);
    assert.ok(ratio("--control-selection-ink", "--well") >= 4.5, `${theme} Include and Avoid hover labels have AA contrast`);
    assert.ok(ratio("--control-selection-boundary", "--surface") >= 3, `${theme} preference selection boundary is visible`);
    assert.ok(ratio("--color-focus", "--surface") >= 3, `${theme} preference focus outline is visible`);
    assert.ok(ratio("--color-disabled-reason", "--surface") >= 4.5, `${theme} disabled preference explanation remains readable`);

    for (const [width, expectedStage, expectedCrop] of [[390, 24, 14], [340, 20, 20], [320, 20, 20]]) {
      await opened.page.setViewportSize({ width, height: 844 });
      const radii = await opened.page.evaluate(() => ({
        stages: [...document.querySelectorAll(".firstrun-stage:not(.firstrun-stage--signature-crop)")]
          .map((stage) => getComputedStyle(stage).borderTopLeftRadius),
        crops: [...document.querySelectorAll(".firstrun-stage--signature-crop")]
          .map((stage) => getComputedStyle(stage).borderTopLeftRadius),
      }));
      assert.ok(radii.stages.length > 0, `${theme} landing has a normal device stage at ${width}px`);
      assert.ok(radii.crops.length > 0, `${theme} landing has a signature crop at ${width}px`);
      assert.ok(radii.stages.every((radius) => radius === `${expectedStage}px`),
        `${theme} normal device stage keeps ${expectedStage}px at ${width}px: ${JSON.stringify(radii)}`);
      assert.ok(radii.crops.every((radius) => radius === `${expectedCrop}px`),
        `${theme} signature crop keeps ${expectedCrop}px at ${width}px: ${JSON.stringify(radii)}`);
    }
    await opened.page.setViewportSize({ width: 390, height: 844 });
    const typography = await opened.page.evaluate(() => ({
      prose: getComputedStyle(document.querySelector('.firstrun-facts b[data-i18n="landing.program.fact2.value"]')).fontFamily,
      data: getComputedStyle(document.querySelector('.firstrun-facts b[data-i18n="landing.program.fact3.value"]')).fontFamily,
    }));
    assert.match(typography.prose, /Plex Sans/, `${theme} ordinary landing prose uses the language font`);
    assert.match(typography.data, /Plex Mono/, `${theme} actual counts and training data retain Mono`);

    const cdp = await opened.context.newCDPSession(opened.page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#firstRunImport" });
    assert.ok(nodeId, "landing Import control is present for pressed-state proof");
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["active"] });
    const pressedImport = await opened.page.locator("#firstRunImport").evaluate((button) => {
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
        expectedInk: resolve("--color-ink", "color"),
        expectedBoundary: resolve("--color-action-text", "color"),
      };
    });
    assert.equal(pressedImport.background, pressedImport.expectedWell, `${theme} Import press retains the hover paper`);
    assert.equal(pressedImport.ink, pressedImport.expectedInk, `${theme} Import press retains hover ink`);
    assert.equal(pressedImport.boundary, pressedImport.expectedBoundary, `${theme} Import press retains its required boundary`);
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
    await cdp.detach();
  }
  await opened.page.evaluate(() => document.documentElement.style.setProperty("--r", "var(--radius-control)"));
  assert.ok((await tokenContract()).errors.some((error) => error.includes("--r no longer resolves")), "wrong alias step is rejected");
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
      <button id="uiBadFocus" style="display:block;outline:2px solid #ddd;background:#fff;color:#111">Focus</button>
      <button id="uiThinFocus" style="display:block;outline:1px solid #111;background:#fff;color:#111">Thin focus</button>
      <p id="uiUnsupported" style="background:linear-gradient(#fff,#eee);color:#333">Gradient</p>
      <button id="uiDisabled" disabled style="color:#aaa;background:#fff">Unavailable</button>
      <p id="uiDisabledReason" style="color:#808080;background:#fff">Why unavailable</p>
    </div>`));
  const measured = await opened.page.evaluate(measureRenderedRoles, [
    { selector: "#uiBadText", kind: "text" }, { selector: "#uiBadIcon", kind: "icon" },
    { selector: "#uiBadBoundary", kind: "boundary" }, { selector: "#uiBadFocus", kind: "focus" },
    { selector: "#uiThinFocus", kind: "focus" },
    { selector: "#uiUnsupported", kind: "text" }, { selector: "#uiDisabled", kind: "disabled-control" },
    { selector: "#uiDisabledReason", kind: "disabled-reason" },
  ]);
  for (const selector of ["#uiBadText", "#uiBadIcon", "#uiBadBoundary", "#uiBadFocus", "#uiThinFocus", "#uiDisabledReason"]) {
    assert.equal(measured.find((item) => item.selector === selector)?.status, "fail", `${selector} deliberate rendered-role failure is rejected: ${JSON.stringify(measured)}`);
  }
  assert.equal(measured.find((item) => item.selector === "#uiUnsupported")?.status, "unsupported", "unresolved effective background blocks rather than passing");
  assert.equal(measured.find((item) => item.selector === "#uiDisabled")?.status, "exempt", "disabled control mass is exempt without exempting its reason");
  await opened.page.evaluate(() => document.querySelector("#uiSystemFaults")?.remove());
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
  console.log("ui-system: exact import-door and import-subview contracts, preference and radius contracts, live ownership, landing label, AA failures, and deliberate contract negatives passed");
} finally { await context?.close(); await browser.close(); preview.cleanup(); }
