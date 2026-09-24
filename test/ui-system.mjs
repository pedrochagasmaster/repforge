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
  }
  await opened.page.evaluate(() => document.documentElement.style.setProperty("--r", "var(--radius-control)"));
  assert.ok((await tokenContract()).errors.some((error) => error.includes("--r no longer resolves")), "wrong alias step is rejected");
  await opened.page.evaluate(() => { document.documentElement.style.removeProperty("--r"); document.documentElement.setAttribute("data-theme", "light"); });
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
  console.log("ui-system: live landing label, six deliberate AA failures, unsupported background, disabled reason, literal and selector negatives passed");
} finally { await context?.close(); await browser.close(); preview.cleanup(); }
