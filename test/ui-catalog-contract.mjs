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
const namespaces = [...new Set(Object.keys(JSON.parse(readFileSync(resolve(root, "i18n-en.json"), "utf8")))
  .flatMap((key) => key.split(".").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("."))))];

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
    const failures = validateCatalogEvidence(evidence, en.config, { knownKeyNamespaces: namespaces });
    assert.deepEqual(failures, [], `actual EN library frame satisfies catalog contract: ${failures.join(" | ")}`);
    assert.equal(evidence.scrollers.length, 2, "the two documented filter rails are measured");
    assert.ok(evidence.scrollers.every((item) => item.marker === "x" && item.tabIndex === 0 && item.cue && item.hasPartialChild),
      `documented scrollers retain marker, keyboard reachability, cue, and partial chip: ${JSON.stringify(evidence.scrollers)}`);
    const moved = await en.page.evaluate(() => {
      const row = document.querySelector("#libMuscleFilters");
      const before = row.scrollLeft;
      row.focus(); row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      return { before, after: row.scrollLeft };
    });
    assert.ok(moved.after > moved.before, `filter rail responds to keyboard horizontal scroll: ${JSON.stringify(moved)}`);

    async function injectedFailures(html) {
      await en.page.evaluate((markup) => document.body.insertAdjacentHTML("beforeend", markup), html);
      const result = validateCatalogEvidence(await en.page.evaluate(collectCatalogEvidence, en.config), en.config, { knownKeyNamespaces: namespaces });
      await en.page.evaluate(() => document.querySelector("#catalogContractBad")?.remove());
      return result;
    }

    const raw = await injectedFailures('<div id="catalogContractBad"><p>day_empty:manual_d1</p></div>');
    assert.ok(raw.some((failure) => failure.startsWith("raw internal copy (day_empty:)")), `raw-key artifact is rejected: ${raw.join(" | ")}`);
    console.log(`deliberate raw-key rejection: ${raw.find((failure) => failure.startsWith("raw internal copy (day_empty:)"))}`);

    const dottedKey = await injectedFailures('<div id="catalogContractBad"><p>picker.equipment.band</p></div>');
    assert.ok(dottedKey.some((failure) => failure.startsWith("raw translation key picker.equipment.band")),
      `known dotted translation-key artifact is rejected: ${dottedKey.join(" | ")}`);
    console.log(`deliberate dotted-key rejection: ${dottedKey.find((failure) => failure.startsWith("raw translation key picker.equipment.band"))}`);

    const clipped = await injectedFailures('<div id="catalogContractBad" style="position:fixed;top:100px;left:0"><button style="display:block;width:20px;padding:0;white-space:nowrap;overflow:hidden">Clipped control text</button></div>');
    assert.ok(clipped.some((failure) => failure.startsWith("clipped button")), `clipped-control artifact is rejected: ${clipped.join(" | ")}`);
    console.log(`deliberate clipped-control rejection: ${clipped.find((failure) => failure.startsWith("clipped button"))}`);

    const overlap = await injectedFailures('<div id="catalogContractBad"></div>');
    await en.page.evaluate(() => {
      document.querySelector("#libMuscleFilters").insertAdjacentHTML("beforeend",
        '<button id="catalogOverlapA" class="pchip" style="position:absolute;left:0;top:0">A</button><button id="catalogOverlapB" class="pchip" style="position:absolute;left:0;top:0">B</button>');
    });
    const overlapFailures = validateCatalogEvidence(await en.page.evaluate(collectCatalogEvidence, en.config), en.config, { knownKeyNamespaces: namespaces });
    await en.page.evaluate(() => { document.querySelector("#catalogOverlapA")?.remove(); document.querySelector("#catalogOverlapB")?.remove(); document.querySelector("#catalogContractBad")?.remove(); });
    assert.ok(overlapFailures.some((failure) => failure.startsWith("overlap #libMuscleFilters")),
      `overlapping-chip artifact is rejected: ${overlapFailures.join(" | ")}`);
    console.log(`deliberate overlap rejection: ${overlapFailures.find((failure) => failure.startsWith("overlap #libMuscleFilters"))}`);
    assert.deepEqual(overlap, [], "a neutral isolated artifact does not create a false failure");
  } finally {
    await en.context.close();
  }

  const pt = await openLibrary("pt");
  try {
    const failures = validateCatalogEvidence(await pt.page.evaluate(collectCatalogEvidence, pt.config), pt.config, { knownKeyNamespaces: namespaces });
    assert.deepEqual(failures, [], `actual PT-BR library frame satisfies catalog contract: ${failures.join(" | ")}`);
  } finally {
    await pt.context.close();
  }
} finally {
  await browser.close();
}

console.log("ui catalog contract: actual EN/PT-BR frame and isolated raw-copy, clipped-control, overlap failures verified");
