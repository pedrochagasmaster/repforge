#!/usr/bin/env node
/**
 * Plan 064 R6a: the rules-only audit (tools/check-rules-only.mjs) must reject a
 * seeded violation of each of its four checks (orange budget, 44px targets,
 * overflow, sheet band), must accept a deliberately compliant control that rides
 * next to every violation, must list exactly the states the treatment table
 * classes `rules only`, and must accept a rendered sample of those states.
 *
 * Each seeded failure is injected into a rendered catalog page (`settings/main`
 * at 360) inside `#gateSeed`, and the check is run over that scope only.
 */
import { ROOT, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { appState } from "../tools/ui-screens/screens-app.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { dismissChrome, setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
import { ORANGE_CATEGORIES, gateManifest } from "../tools/check-direction-d.mjs";
import {
  CHECKS, NON_SHEET_DIALOGS, RULES_ONLY_EXTRA_ALLOWLIST, RULES_ONLY_ORANGE_ALLOWLIST, RULES_ONLY_STATES,
  ONBOARDING_ACCENT_SCOPE, checkSheetBand, gatherRulesOnlyEvidence, readRulesOnlyTreatment, runOnboardingOrange, runRulesOnly, validateRulesOnlyConfig, validateRulesOnlyList,
} from "../tools/check-rules-only.mjs";

const results = { passed: 0, failed: 0 };
function check(condition, name, detail = "") {
  if (condition) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}
const has = (failures, ...needles) => failures.some((failure) => needles.every((needle) => failure.includes(needle)));
const show = (failures) => JSON.stringify(failures.slice(0, 4));

const manifest = loadManifest();
const gate = gateManifest(manifest);

// ---------------------------------------------------------------- the list
console.log("\nThe rules-only state list");
{
  const treatment = readRulesOnlyTreatment();
  check(treatment.length === 64, "the treatment table classes 64 screens `rules only`", `found ${treatment.length}`);
  check(RULES_ONLY_STATES.length === 64 && new Set(RULES_ONLY_STATES).size === 64, "the audit lists 64 distinct states");
  const problems = validateRulesOnlyList(RULES_ONLY_STATES, manifest, treatment);
  check(problems.length === 0, "the audit's list is the treatment table's `rules only` set and every state is in the live manifest", show(problems));
  check(!RULES_ONLY_STATES.some((key) => /^onboarding-/.test(key)), "no onboarding screen is listed (their treatment is the landing or the onboarding direction)");
  check(validateRulesOnlyList([...RULES_ONLY_STATES, "today/not-a-state"], manifest).some((item) => item.includes("today/not-a-state") && item.includes("manifest")),
    "a listed state missing from the live manifest is rejected (the list cannot rot)");
  check(validateRulesOnlyList(["today/no-program", "today/no-program"], manifest).some((item) => item.includes("duplicate")), "a duplicated state is rejected");
  check(validateRulesOnlyList(RULES_ONLY_STATES.slice(1), manifest, treatment).some((item) => item.includes("treatment table")),
    "a `rules only` screen missing from the audit is rejected");
  check(validateRulesOnlyConfig().length === 0, "the rules-only allowlist and overflow exceptions are valid", show(validateRulesOnlyConfig()));
  check(RULES_ONLY_ORANGE_ALLOWLIST.every((entry) => ORANGE_CATEGORIES.includes(entry.category)) &&
    RULES_ONLY_EXTRA_ALLOWLIST.every((entry) => ORANGE_CATEGORIES.includes(entry.category)),
  "every rules-only allowlist entry sits in one of the five budget categories", ORANGE_CATEGORIES.join(", "));
  check(validateRulesOnlyConfig({ allowlist: [{ category: "decoration", selector: ".x" }] }).some((item) => item.includes("decoration")),
    "an allowlist entry outside the five budget categories is rejected");
  check(validateRulesOnlyConfig({ allowlist: [{ category: "cta-arrow", selector: "body" }] }).some((item) => item.includes("too broad")),
    "an allowlist entry that names the whole page is rejected");
  check(Object.keys(CHECKS).sort().join() === "orange,overflow,sheetband,targets", "the audit runs exactly the four checks the packet names");
  check(NON_SHEET_DIALOGS.every((item) => item.selector && item.reason), "every documented non-sheet dialog carries its reason");
}

// ------------------------------------------------------------ the real app
const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
setCaptureBase(preview.env.REPFORGE_URL);
const browser = await launchChromium();
try {
  async function openState(locale, key = "settings/main") {
    const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-360", theme: "light", locale, text: "normal", motion: "normal" };
    const opened = await openPage(browser, gate, capture, appState(key, manifest.locales[locale].lang));
    await dismissChrome(opened.page);
    await settle(opened.page);
    return opened;
  }
  async function seeded(page, html, options = {}) {
    await page.evaluate((markup) => {
      document.querySelector("#gateSeed")?.remove();
      document.body.insertAdjacentHTML("beforeend", `<div id="gateSeed">${markup}</div>`);
    }, html);
    return gatherRulesOnlyEvidence(page, { scope: "#gateSeed", ...options });
  }

  const en = await openState("en");
  try {
    const page = en.page;
    check(await page.evaluate(() => window.innerWidth) === 360, "the audit renders at 360 CSS px");

    // ------------------------------------------------------------ 1. orange
    console.log("\n1. Orange budget");
    const orangeMarkup = `
      <div id="seedOrangeFill" style="width:20px;height:20px;background:var(--accent)"></div>
      <span id="seedOrangeText" style="color:var(--accent-deep)">label</span>
      <div id="seedOrangeBorder" style="width:20px;height:20px;border:2px solid var(--accent)"></div>
      <div id="seedInkOnly" style="width:20px;height:20px;background:var(--ink);color:var(--ink-soft)">ink</div>
      <div id="seedPositive" style="width:20px;height:20px;background:var(--positive)">record</div>`;
    const orange = CHECKS.orange(await seeded(page, orangeMarkup, { allowlist: [] }));
    for (const id of ["seedOrangeFill", "seedOrangeText", "seedOrangeBorder"]) {
      check(has(orange, "orange", `#${id}`), `an accent-painted element off the list is rejected: #${id}`, show(orange));
    }
    check(!has(orange, "#seedInkOnly") && !has(orange, "#seedPositive"), "ink paint and the --positive record colour are accepted", show(orange));
    const listed = CHECKS.orange(await seeded(page, orangeMarkup, { allowlist: [{ category: "verdict-glyph", selector: "#seedOrangeFill" }] }));
    check(!has(listed, "#seedOrangeFill") && has(listed, "#seedOrangeText") && has(listed, "#seedOrangeBorder"),
      "a listed element passes and the others still fail beside it", show(listed));
    // The focused control's focus indicator is the contract's focus role, not an accent use; the same paint unfocused is not.
    await page.evaluate(() => {
      document.querySelector("#gateSeed")?.remove();
      document.body.insertAdjacentHTML("beforeend", `<div id="gateSeed"><input id="seedFocused" style="display:block;width:200px;height:44px">
        <input id="seedUnfocused" style="display:block;width:200px;height:44px;border:2px solid var(--accent)"></div>`);
      document.querySelector("#seedFocused").focus();
    });
    const focusEvidence = await gatherRulesOnlyEvidence(page, { scope: "#gateSeed", allowlist: [] });
    const focusOrange = CHECKS.orange(focusEvidence);
    check(!has(focusOrange, "#seedFocused") && (focusEvidence.accent.focusIndicators || []).some((item) => item.locator === "#seedFocused"),
      "the focused control's focus indicator is set aside as a focus indicator, not reported", show(focusOrange));
    check(has(focusOrange, "orange", "#seedUnfocused"), "accent paint on an unfocused control is still reported beside it", show(focusOrange));
    const real = CHECKS.orange(await gatherRulesOnlyEvidence(page, { allowlist: [] }));
    check(real.length > 0, "the detector is not vacuous: Settings' own accent paint is found with an empty list");
    check(RULES_ONLY_ORANGE_ALLOWLIST.some((entry) => entry.category === "active-dock-icon"), "the inherited D list carries the dock's active item");

    // ------------------------------------------------------------ 2. targets
    console.log("\n2. Targets");
    const targetsMarkup = `
      <button id="seedSmall" style="width:30px;height:30px;min-width:0;min-height:0;padding:0">x</button>
      <a id="seedSmallLink" href="#seed" style="display:inline-block;width:44px;height:30px;min-height:0">y</a>
      <button id="seedBigEnough" style="width:44px;height:44px;padding:0">ok</button>
      <button id="seedHidden" hidden style="width:10px;height:10px">hidden</button>`;
    const targets = CHECKS.targets(await seeded(page, targetsMarkup));
    for (const id of ["seedSmall", "seedSmallLink"]) check(has(targets, "targets", `#${id}`), `a sub-44 control is rejected: #${id}`, show(targets));
    check(!has(targets, "#seedBigEnough") && !has(targets, "#seedHidden"), "a 44 x 44 control and a hidden control are accepted", show(targets));

    // ------------------------------------------------------------ 3. overflow
    console.log("\n3. Overflow");
    const overflowMarkup = `
      <div id="seedWide" style="width:200px;overflow:hidden"><div style="width:600px;height:10px"></div></div>
      <div id="seedFits" style="width:200px;overflow:hidden"><div style="width:100px;height:10px"></div></div>
      <p id="seedEllipsis" style="width:100px;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">A very long exercise name that cannot fit</p>
      <div class="tabrow" id="seedTabRow" style="width:200px;overflow-x:auto"><div style="width:600px;height:10px"></div></div>
      <div id="seedRail" data-allow-horizontal-scroll="x" style="width:200px;overflow-x:auto"><div style="width:600px;height:10px"></div></div>
      <div id="seedUnmarkedRail" style="width:200px;overflow-x:auto"><div style="width:600px;height:10px"></div></div>`;
    const overflow = CHECKS.overflow(await seeded(page, overflowMarkup));
    check(has(overflow, "overflow", "#seedWide"), "an element wider than its box is rejected", show(overflow));
    check(!has(overflow, "#seedFits"), "an element that fits its box is accepted", show(overflow));
    check(!has(overflow, "#seedTabRow"), "Progress' tab row, the one scrolling row, is excepted", show(overflow));
    check(!has(overflow, "#seedRail"), "a sideways rail registered as an intentional scroller (the plan-050 marker) is excepted", show(overflow));
    check(has(overflow, "overflow", "#seedUnmarkedRail"), "a scrolling row without the marker is still reported", show(overflow));
    check(has(overflow, "ellipsis", "#seedEllipsis"), "text-overflow: ellipsis is rejected (section 8.13: names wrap, never ellipsized)", show(overflow));
    check(!has(overflow, "ellipsis", "#seedFits"), "an element with no ellipsis is not reported for one", show(overflow));

    // ------------------------------------------------------------ 4. sheet band
    console.log("\n4. Sheet band");
    const legacySheet = `<div id="seedLegacy" class="sheet" role="dialog" style="position:static;transform:none;display:block"><span class="sheet__grab"></span><div class="sheet__head"><p class="sheet__title">Old</p></div></div>`;
    const bandSheet = `<div id="seedBanded" class="sheet" role="dialog" style="position:static;transform:none;display:block"><div class="sheetband"><span class="sheetband__handle" aria-hidden="true"></span><h2 class="sheetband__title">New</h2></div></div>`;
    const noTitle = `<div id="seedNoTitle" class="sheet" role="dialog" style="position:static;transform:none;display:block"><div class="sheetband"><span class="sheetband__handle" aria-hidden="true"></span></div></div>`;
    const doubleHead = `<div id="seedDouble" class="sheet" role="dialog" style="position:static;transform:none;display:block"><div class="sheetband"><span class="sheetband__handle"></span><h2 class="sheetband__title">Both</h2></div><div class="sheet__head"><p class="sheet__title">Old</p></div></div>`;
    const stray = `<div id="seedStray" role="dialog" style="display:block">A dialog that is not a sheet and is not documented</div>`;
    const bands = CHECKS.sheetband((await seeded(page, legacySheet + bandSheet + noTitle + doubleHead + stray)).sheetEvidence);
    check(has(bands, "sheetband", "#seedLegacy", "not .sheetband"), "a sheet headed by the old grab and head is rejected", show(bands));
    check(!has(bands, "#seedBanded"), "a sheet headed by .sheetband with a handle and a title is accepted", show(bands));
    check(has(bands, "#seedNoTitle", "sheetband__title"), "a .sheetband with no title is rejected", show(bands));
    check(has(bands, "#seedDouble", "legacy head"), "a legacy head left beside the band is rejected", show(bands));
    check(has(bands, "#seedStray", "neither a .sheet"), "an open dialog that is neither a sheet nor documented is rejected", show(bands));
    const hiddenSheet = CHECKS.sheetband((await seeded(page, legacySheet.replace("<div id=\"seedLegacy\"", "<div hidden id=\"seedLegacy\""))).sheetEvidence);
    check(hiddenSheet.length === 0, "a closed sheet is not audited");
    const documented = CHECKS.sheetband((await seeded(page, "<div id=\"glossary\" role=\"dialog\" style=\"display:block\">term</div>")).sheetEvidence);
    check(documented.length === 0, "a documented non-sheet dialog (the glossary popover) is accepted", show(documented));
    check(has(checkSheetBand({ error: "scope #nope not found" }), "scope"), "an unfound scope is an error, never a pass");
  } finally {
    await en.context.close();
  }

  // ------------------------------------------------ the audit over real states
  // ------------------------------------------------ the audit over real states
  console.log("\nThe audit over rendered rules-only states");
  const sample = ["settings/privacy-disclosure", "install/ios-sheet", "program/custom-exercise", "program/text-export"];
  const run = await runRulesOnly({ states: sample, locales: ["pt", "en"], browser, manifest });
  check(run.rendered.length === sample.length * 2, "every sampled state was rendered in PT and EN", JSON.stringify(run.rendered));
  check(run.ok && run.findings.length === 0, "the sampled sheet states pass all four checks in PT and EN at 360",
    show(run.findings.map((item) => `${item.key} [${item.locale}] ${item.message}`)));
  check(sample.every((key) => run.rendered.filter((item) => item.key === key).every((item) => item.sheets > 0)),
    "each sampled state was audited as an open sheet", JSON.stringify(run.rendered.map((item) => `${item.key}:${item.sheets}`)));

  // ------------------------------------------------ R7 V-12: the onboarding accent budget
  // The pain note and the hub guide cue sit on --well with an --ink-soft shield; the same checkOrange the D gate runs
  // reports nothing on them, in both themes and both languages. A seeded accent edge on the pain note is reported, so the
  // audit bites. (Other onboarding accent uses are out of this finding's scope and come back in `outside`.)
  console.log("\nThe onboarding accent budget (owner decision #295 comment 5965828337)");
  const v12 = ["onboarding-start/hub", "onboarding-start/hub-own-open", "onboarding-start/hub-existing", "onboarding-start/hub-help", "onboarding-recommend/avoidance-pain"];
  for (const theme of ["light", "dark"]) {
    const onboarding = await runOnboardingOrange({ states: v12, locales: ["pt", "en"], theme, browser, manifest });
    check(onboarding.rendered.length === v12.length * 2, `every pain-note and hub state rendered in PT and EN (${theme})`, JSON.stringify(onboarding.rendered));
    check(onboarding.ok && onboarding.findings.length === 0, `the pain note and the hub guide cue use no accent (${theme})`,
      show(onboarding.findings.map((item) => `${item.key} [${item.locale}] ${item.message}`)));
  }
  const seededPain = await runOnboardingOrange({
    states: ["onboarding-recommend/avoidance-pain"], locales: ["en"], browser, manifest,
    prepare: (page) => page.addStyleTag({ content: ".entry__pain{border-left:3px solid var(--accent) !important}" }),
  });
  check(!seededPain.ok && seededPain.findings.some((item) => /entry__pain/.test(item.message) && /border-left-color/.test(item.message)),
    "an accent edge on the pain note is reported by the same check", show(seededPain.findings.map((item) => item.message)));
  check(ONBOARDING_ACCENT_SCOPE.test("p.entry__pain in #onbBody is painted with the accent") && ONBOARDING_ACCENT_SCOPE.test("aside.guide-cue in #onbBody is painted with the accent"),
    "the audit's scope is the pain note and the hub guide cue");

  console.log("\nThe audit refuses a bad list");
  const broken = await runRulesOnly({ states: ["today/not-a-state"], locales: ["en"], browser, manifest });
  check(!broken.ok && broken.config.length > 0, "a state missing from the manifest fails the audit before anything renders");
} finally {
  await browser.close();
  preview.cleanup();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed > 0 ? 1 : 0);
