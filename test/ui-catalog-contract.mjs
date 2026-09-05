import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertServingApp, launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";
import { collectCatalogEvidence, configForCapture, validateCatalogEvidence, validateCatalogMetadata } from "../tools/ui-screens/catalog-contract.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = loadManifest();
const dictionary = JSON.parse(readFileSync(resolve(root, "i18n-en.json"), "utf8"));
const namespaces = [...new Set(Object.keys(dictionary)
  .flatMap((key) => key.split(".").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("."))))];
const keys = Object.keys(dictionary);
const validate = (evidence, config) => validateCatalogEvidence(evidence, config, { knownKeyNamespaces: namespaces, knownKeys: keys });

assert.deepEqual(validateCatalogMetadata(manifest), [], "catalog metadata is explicit and internally consistent");
await assertServingApp();

const browser = await launchChromium();
try {
  async function openLibrary(locale) {
    const capture = { flow: "library", screen: "list", viewport: "phone-390", theme: "light", locale, text: "normal", motion: "normal" };
    const opened = await openPage(browser, manifest, capture, appState("library/list", manifest.locales[locale].lang));
    await dismissChrome(opened.page);
    await APP_SCENARIOS["library/list"](opened.page);
    await settle(opened.page);
    return { ...opened, capture, config: configForCapture(manifest, capture) };
  }

  const en = await openLibrary("en");
  try {
    const evidence = await en.page.evaluate(collectCatalogEvidence, en.config);
    const failures = validate(evidence, en.config);
    assert.deepEqual(failures, [], `actual EN library frame satisfies the catalog contract: ${failures.join(" | ")}`);
    assert.equal(evidence.scrollers.length, 2, "the two documented filter rails are measured");
    assert.ok(evidence.scrollers.every((item) => item.marker === "x" && item.tabIndex === 0 && item.cue && item.hasPartialChild &&
      ["auto", "scroll", "overlay"].includes(item.overflowX) && item.touchAction !== "none"),
    `documented scrollers retain native touch/keyboard reachability, cue, and partial chip: ${JSON.stringify(evidence.scrollers)}`);
    const moved = await en.page.evaluate(() => [...document.querySelectorAll("#libFilters [data-allow-horizontal-scroll]")].map((row) => {
      const before = row.scrollLeft;
      row.focus(); row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      return { id: row.id, before, after: row.scrollLeft };
    }));
    assert.ok(moved.every((item) => item.after > item.before), `each filter rail responds to keyboard horizontal scroll: ${JSON.stringify(moved)}`);

    async function injectedFailures(html) {
      await en.page.evaluate((markup) => document.body.insertAdjacentHTML("beforeend", markup), html);
      const result = validate(await en.page.evaluate(collectCatalogEvidence, en.config), en.config);
      await en.page.evaluate(() => document.querySelector("#catalogContractBad")?.remove());
      return result;
    }

    const raw = await injectedFailures('<div id="catalogContractBad"><p id="catalogRawKey">day_empty:manual_d1</p></div>');
    assert.ok(raw.some((failure) => failure.startsWith("raw internal copy (day_empty:)")), `raw-key artifact is rejected: ${raw.join(" | ")}`);
    console.log(`deliberate raw-key rejection: ${raw.find((failure) => failure.startsWith("raw internal copy (day_empty:)"))}`);

    const dottedKey = await injectedFailures('<div id="catalogContractBad"><p id="catalogDottedKey">picker.equipment.band</p></div>');
    assert.ok(dottedKey.some((failure) => failure.startsWith("raw translation key picker.equipment.band")),
      `known dotted translation-key artifact is rejected: ${dottedKey.join(" | ")}`);
    console.log(`deliberate dotted-key rejection: ${dottedKey.find((failure) => failure.startsWith("raw translation key picker.equipment.band"))}`);

    await en.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div id="catalogContractBad"><p id="catalogMissingKey" data-i18n="brandnew.missing_key">placeholder</p></div>'));
    await en.page.evaluate(() => window.RepForgeI18n.applyDom());
    const missingKey = validate(await en.page.evaluate(collectCatalogEvidence, en.config), en.config);
    await en.page.evaluate(() => document.querySelector("#catalogContractBad")?.remove());
    assert.ok(missingKey.some((failure) => failure.startsWith("missing requested translation key brandnew.missing_key")),
      `missing requested key is rejected at the i18n/capture boundary: ${missingKey.join(" | ")}`);
    console.log(`deliberate missing-request rejection: ${missingKey.find((failure) => failure.startsWith("missing requested translation key brandnew.missing_key"))}`);

    const copyConfig = { ...en.config, renderedCopyAllowances: [{
      screen: "library/list", locator: "#catalogCopyAllowance", text: "day_empty:documented", reason: "Fixture proves a locator-bound exception.", owner: "plan-050",
    }] };
    await en.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div id="catalogContractBad"><p id="catalogCopyAllowance">day_empty:documented</p></div>'));
    const allowedCopy = validate(await en.page.evaluate(collectCatalogEvidence, copyConfig), copyConfig);
    await en.page.evaluate(() => document.querySelector("#catalogContractBad")?.remove());
    assert.ok(!allowedCopy.some((failure) => failure.startsWith("raw internal copy (day_empty:)")),
      `documented locator-bound copy allowance passes: ${allowedCopy.join(" | ")}`);
    const unrelatedCopy = await injectedFailures('<div id="catalogContractBad"><p id="catalogUnrelatedCopy">day_empty:documented</p></div>');
    assert.ok(unrelatedCopy.some((failure) => failure.startsWith("raw internal copy (day_empty:)")),
      `copy allowance does not suppress unrelated text: ${unrelatedCopy.join(" | ")}`);

    const clipped = await injectedFailures('<div id="catalogContractBad" style="position:fixed;top:100px;left:0"><button style="display:block;width:20px;padding:0;white-space:nowrap;overflow:hidden">Clipped control text</button></div>');
    assert.ok(clipped.some((failure) => failure.startsWith("clipped button")), `clipped-control artifact is rejected: ${clipped.join(" | ")}`);
    console.log(`deliberate clipped-control rejection: ${clipped.find((failure) => failure.startsWith("clipped button"))}`);

    const rogueScroller = await injectedFailures('<div id="catalogContractBad"><div id="rogue" data-catalog-layout data-allow-horizontal-scroll="x" style="width:20px;overflow:hidden;white-space:nowrap">Rogue overflowing element</div></div>');
    assert.ok(rogueScroller.some((failure) => failure.startsWith("clipped div #rogue")),
      `an element cannot self-allow overflow without exact manifest metadata: ${rogueScroller.join(" | ")}`);
    console.log(`deliberate rogue-scroller rejection: ${rogueScroller.find((failure) => failure.startsWith("clipped div #rogue"))}`);

    const belowFold = await injectedFailures('<div id="catalogContractBad" style="position:absolute;top:1200px"><button id="offscreen-clipped" style="display:block;width:20px;padding:0;white-space:nowrap;overflow:hidden">Offscreen clipped control</button></div>');
    assert.ok(belowFold.some((failure) => failure.startsWith("clipped button #offscreen-clipped")),
      `a below-fold clipped control is still measured: ${belowFold.join(" | ")}`);
    console.log(`deliberate below-fold rejection: ${belowFold.find((failure) => failure.startsWith("clipped button #offscreen-clipped"))}`);

    const overlap = await injectedFailures('<div id="catalogContractBad"></div>');
    assert.deepEqual(overlap, [], "a neutral isolated artifact does not create a false failure");
    await en.page.evaluate(() => {
      document.querySelector("#libMuscleFilters").insertAdjacentHTML("beforeend",
        '<button id="catalogOverlapA" class="pchip" style="position:absolute;left:0;top:0">A</button><button id="catalogOverlapB" class="pchip" style="position:absolute;left:0;top:0">B</button>');
    });
    const overlapFailures = validate(await en.page.evaluate(collectCatalogEvidence, en.config), en.config);
    await en.page.evaluate(() => { document.querySelector("#catalogOverlapA")?.remove(); document.querySelector("#catalogOverlapB")?.remove(); document.querySelector("#catalogContractBad")?.remove(); });
    assert.ok(overlapFailures.some((failure) => failure.includes("#catalogOverlapA") && failure.includes("#catalogOverlapB")),
      `overlapping-chip artifact is rejected: ${overlapFailures.join(" | ")}`);
    console.log(`deliberate overlap rejection: ${overlapFailures.find((failure) => failure.includes("#catalogOverlapA") && failure.includes("#catalogOverlapB"))}`);
  } finally {
    await en.context.close();
  }

  const pt = await openLibrary("pt");
  try {
    const failures = validate(await pt.page.evaluate(collectCatalogEvidence, pt.config), pt.config);
    assert.deepEqual(failures, [], `actual PT-BR library frame satisfies the catalog contract: ${failures.join(" | ")}`);
  } finally {
    await pt.context.close();
  }
} finally {
  await browser.close();
}

console.log("ui catalog contract: actual EN/PT-BR green after cross-rail repair and isolated copy, overflow, overlap escapes verified");
