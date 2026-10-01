#!/usr/bin/env node
/**
 * Plan 064 R3a (Plan 063 P3a): Direction D's five review-page acceptance
 * checks, run against the real app, must reject a seeded violation of each
 * check, must not fail a D state that is still pending, and must accept every
 * state an R3 sub-slice has built (R3c: the three Focus states).
 *
 * Each seeded failure is injected into a rendered catalog page (`today/ready`
 * at 360, EN and PT where locale matters) inside `#gateSeed`, and the check is
 * run over that scope only. A deliberately compliant control rides next to
 * every violation, so a check that rejects everything also fails here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { appState } from "../tools/ui-screens/screens-app.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
import {
  DIRECTION_D_STATES, GAPS, ORANGE_CATEGORIES, checkOrange, checkOverflow, checkParity, checkStrings,
  checkTargets, gateManifest, gatherEvidence, loadCatalog, runGate, validateGateConfig, validateStateList,
} from "../tools/check-direction-d.mjs";

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
console.log("\nD-owned state list");
{
  const doc = readFileSync(join(ROOT, "docs/design/plan-064-reconciliation.md"), "utf8");
  const owned = doc.split("\n").map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 8 && /^`[a-z-]+\/[a-z-]+`$/.test(cells[1]) && cells[4] === "`redesign (D)`")
    .map((cells) => cells[1].replaceAll("`", ""));
  check(owned.length === 35, "the treatment table has 35 `redesign (D)` screens", `found ${owned.length}`);
  check(DIRECTION_D_STATES.length === 35 && DIRECTION_D_STATES.every((item) => owned.includes(item.key)) &&
    owned.every((key) => DIRECTION_D_STATES.some((item) => item.key === key)),
  "the gate's state list is exactly those 35 states", `${DIRECTION_D_STATES.length} listed`);
  const built = ["workout/focus", "workout/focus-glossary", "workout/correction"];
  check(DIRECTION_D_STATES.every((item) => (item.status === "implemented") === built.includes(item.key)) &&
    DIRECTION_D_STATES.filter((item) => item.status === "implemented").length === built.length,
  "only the states an R3 sub-slice has built are implemented; every other D state is pending",
  JSON.stringify(DIRECTION_D_STATES.filter((item) => item.status === "implemented").map((item) => item.key)));
  check(validateStateList(DIRECTION_D_STATES, manifest).length === 0, "the list is valid against the live manifest",
    show(validateStateList(DIRECTION_D_STATES, manifest)));
  check(has(validateStateList([{ key: "today/not-a-state", status: "pending" }], manifest), "today/not-a-state", "manifest"),
    "a listed state missing from the live manifest is rejected (the list cannot rot)");
  check(has(validateStateList([{ key: "today/ready", status: "pending" }, { key: "today/ready", status: "pending" }], manifest), "duplicate"),
    "a duplicated state is rejected");
  check(has(validateStateList([{ key: "today/ready", status: "done" }], manifest), "status"),
    "a status other than pending or implemented is rejected");
  check(has(validateGateConfig({ allowlist: [{ category: "decoration", selector: ".x" }], exceptions: [] }), "decoration"),
    "an orange allowlist entry outside the five budget categories is rejected");
  check(ORANGE_CATEGORIES.length === 5, "the orange budget names exactly five categories", ORANGE_CATEGORIES.join(", "));
  check(GAPS.length > 0 && GAPS.every((gap) => typeof gap === "string" && gap.length > 40),
    "every rule no governing document provides is recorded as an explicit gap", `${GAPS.length} gaps`);
}

// ------------------------------------------------------------ the real app
const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
setCaptureBase(preview.env.REPFORGE_URL);
const browser = await launchChromium();
try {
  async function openState(locale, key = "today/ready") {
    const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-360", theme: "light", locale, text: "normal", motion: "normal" };
    const opened = await openPage(browser, gate, capture, appState(key, manifest.locales[locale].lang));
    await opened.page.evaluate(() => window.closeFirstRun?.());
    await settle(opened.page);
    return opened;
  }
  async function seeded(page, html, options = {}) {
    await page.evaluate((markup) => {
      document.querySelector("#gateSeed")?.remove();
      document.body.insertAdjacentHTML("beforeend", `<div id="gateSeed">${markup}</div>`);
    }, html);
    return gatherEvidence(page, { scope: "#gateSeed", ...options });
  }

  const en = await openState("en");
  try {
    const page = en.page;
    check(await page.evaluate(() => window.innerWidth) === 360, "the gate renders at 360 CSS px");

    // ------------------------------------------------------------ 1. targets
    console.log("\n1. Targets");
    const targetsMarkup = `
      <button id="seedSmall" style="width:30px;height:30px;min-width:0;min-height:0;padding:0">x</button>
      <a id="seedSmallLink" href="#seed" style="display:inline-block;width:44px;height:30px;min-height:0">y</a>
      <input id="seedSmallInput" style="display:block;width:120px;height:30px;min-height:0;box-sizing:border-box">
      <div id="seedSmallRole" role="button" tabindex="0" style="width:30px;height:48px;min-width:0">z</div>
      <button id="seedBigEnough" style="width:44px;height:44px;padding:0">ok</button>
      <a id="seedBigLink" href="#seed" style="display:inline-block;width:60px;height:48px">ok</a>
      <button id="seedHidden" hidden style="width:10px;height:10px">hidden</button>`;
    const targets = checkTargets(await seeded(page, targetsMarkup));
    for (const id of ["seedSmall", "seedSmallLink", "seedSmallInput", "seedSmallRole"]) {
      check(has(targets, "targets", `#${id}`), `a sub-44 control is rejected: #${id}`, show(targets));
    }
    check(!has(targets, "#seedBigEnough") && !has(targets, "#seedBigLink") && !has(targets, "#seedHidden"),
      "a 44 x 44 control, a 48 px link and a hidden control are accepted", show(targets));

    // ------------------------------------------------------------ 2. overflow
    console.log("\n2. Overflow");
    const overflowMarkup = `
      <div id="seedWide" style="width:200px;overflow:hidden"><div style="width:600px;height:10px"></div></div>
      <p id="seedEllipsis" style="width:100px;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">A very long exercise name that cannot fit</p>
      <div id="seedFits" style="width:200px;overflow:hidden"><div style="width:100px;height:10px"></div></div>
      <div id="seedTabs" style="width:200px;overflow-x:auto"><div style="width:600px;height:10px"></div></div>`;
    const overflow = checkOverflow(await seeded(page, overflowMarkup));
    check(has(overflow, "overflow", "#seedWide"), "an element wider than its box is rejected", show(overflow));
    check(has(overflow, "ellipsis", "#seedEllipsis"), "text-overflow: ellipsis is rejected", show(overflow));
    check(!has(overflow, "#seedFits"), "an element that fits its box is accepted", show(overflow));
    check(has(overflow, "#seedTabs"), "a scrolling row is rejected when it is not the tab row", show(overflow));
    const excepted = checkOverflow(await seeded(page, overflowMarkup, { exceptions: [{ id: "tab-row", selector: "#seedTabs" }] }));
    check(!has(excepted, "#seedTabs") && has(excepted, "#seedWide"),
      "the tab row, and only the tab row, is excepted", show(excepted));

    // ------------------------------------------------------------ 3. orange
    console.log("\n3. Orange budget");
    const orangeMarkup = `
      <div id="seedOrangeFill" style="width:20px;height:20px;background:var(--accent)"></div>
      <span id="seedOrangeText" style="color:var(--accent-deep)">label</span>
      <div id="seedOrangeBorder" style="width:20px;height:20px;border:2px solid var(--accent)"></div>
      <div id="seedOrangePseudo" style="width:20px;height:20px"></div>
      <style>#seedOrangePseudo::after{content:"";display:block;width:8px;height:8px;background:var(--accent)}</style>
      <div id="seedInkOnly" style="width:20px;height:20px;background:var(--ink);color:var(--ink-soft)">ink</div>`;
    const orange = checkOrange(await seeded(page, orangeMarkup, { allowlist: [] }));
    for (const id of ["seedOrangeFill", "seedOrangeText", "seedOrangeBorder", "seedOrangePseudo"]) {
      check(has(orange, "orange", `#${id}`), `an accent-painted element off the list is rejected: #${id}`, show(orange));
    }
    check(!has(orange, "#seedInkOnly"), "an ink-only element is accepted", show(orange));
    const listed = checkOrange(await seeded(page, orangeMarkup, { allowlist: [
      { category: "verdict-glyph", selector: "#seedOrangeFill" },
      { category: "cta-arrow", selector: "#seedOrangePseudo", pseudo: "::after" },
    ] }));
    check(!has(listed, "#seedOrangeFill") && !has(listed, "#seedOrangePseudo"),
      "the same elements pass when they are on the list", show(listed));
    check(has(listed, "#seedOrangeText") && has(listed, "#seedOrangeBorder"),
      "an element that is not on the list still fails beside listed ones", show(listed));
    const real = await gatherEvidence(page, { scope: "body", allowlist: [] });
    const realOrange = checkOrange(real);
    check(realOrange.length > 0, "the detector is not vacuous: today's own accent paint is found with an empty list",
      `accent colours ${JSON.stringify(real.accent?.colors)}`);

    // ------------------------------------------------------------ 4. parity
    console.log("\n4. Parity");
    const probe = await page.evaluate(() => {
      const P = window.__repforgeProgression;
      const log = JSON.parse(localStorage.getItem("repforge_v1")).log;
      for (const slot of JSON.parse(localStorage.getItem("repforge_v1")).program) {
        const ex = P.programSlot(slot.id);
        const rows = log.filter((row) => row.exerciseId === slot.id);
        if (!ex || !rows.length) continue;
        const session = rows.map((row) => row.session).sort().at(-1);
        const cmp = window.__repforgeCompareExercise(ex, rows.filter((row) => row.session === session));
        const rec = P.recommendation(ex);
        if (Number.isFinite(rec.load) && cmp.label) return { id: slot.id, session, label: cmp.label, load: rec.load };
      }
      return null;
    });
    check(!!probe, "the catalog lifter has an exercise with an outcome and a recommended load", JSON.stringify(probe));
    if (probe) {
      const other = probe.label === "Improved" ? "Flat" : "Improved";
      const good = `<span id="seedOutcomeOk" data-parity-outcome="${probe.id}" data-parity-session="${probe.session}">${probe.label}</span>
        <span id="seedTargetOk" data-parity-target="${probe.id}">3 × 7 at ${String(probe.load).replace(".", ",")}</span>`;
      const okFailures = checkParity(await seeded(page, good));
      check(okFailures.length === 0, "a shown outcome word and target that match the app are accepted", show(okFailures));
      const defaulted = checkParity(await seeded(page, `<span id="seedOutcomeDefault" data-parity-outcome="${probe.id}">${probe.label}</span>`));
      check(defaulted.length === 0, "without data-parity-session the latest logged session is compared", show(defaulted));
      const wrongWord = checkParity(await seeded(page, `<span id="seedOutcomeBad" data-parity-outcome="${probe.id}" data-parity-session="${probe.session}">${other}</span>`));
      check(has(wrongWord, "parity", "#seedOutcomeBad", probe.label), `a wrong outcome word is rejected (${other} for ${probe.label})`, show(wrongWord));
      const wrongLoad = checkParity(await seeded(page, `<span id="seedTargetBad" data-parity-target="${probe.id}">3 × 7 at ${probe.load + 2.5}</span>`));
      check(has(wrongLoad, "parity", "#seedTargetBad"), "a target that differs from recommendation() is rejected", show(wrongLoad));
      const unknown = checkParity(await seeded(page, `<span id="seedOutcomeUnknown" data-parity-outcome="no-such-exercise">${probe.label}</span>`));
      check(has(unknown, "#seedOutcomeUnknown", "no-such-exercise"), "a parity marker naming an unknown exercise is rejected", show(unknown));
      const orphan = checkParity(await seeded(page, `<span id="seedOrphan">${probe.label}</span>`));
      check(has(orphan, "#seedOrphan", "outcome word"), "an outcome word with no parity marker is rejected", show(orphan));
    }

    // ------------------------------------------------------------ 5. strings
    console.log("\n5. Strings");
    const catalog = { en: loadCatalog("en"), pt: loadCatalog("pt") };
    const stringsMarkup = `
      <p id="seedRawKey">picker.equipment.band</p>
      <p id="seedBannedPt">Regrediu</p>
      <p id="seedEmDash">Done — nice work</p>
      <p id="seedNotCatalog">Quantum flux capacitor engaged</p>
      <div class="restdial"><button id="seedHold" type="button">Hold</button></div>
      <p id="seedCatalogOk"></p><p id="seedDataOk"></p><p id="seedNumbersOk">3 × 7 · 102,5 kg</p>`;
    const prepared = async (markup, lang = "en", options = {}) => {
      const evidence = await seeded(page, markup, options);
      return checkStrings(evidence, catalog[lang]);
    };
    const strings = await prepared(stringsMarkup);
    check(has(strings, "strings", "picker.equipment.band"), "a raw translation key is rejected", show(strings));
    check(has(strings, "banned", "Regrediu"), "a banned word is rejected", show(strings));
    check(has(strings, "banned", "#seedEmDash"), "an em dash is rejected", show(strings));
    check(has(strings, "not a catalog", "Quantum flux capacitor engaged"), "a rendered string that is not a catalog key is rejected", show(strings));
    check(has(strings, "banned", "Hold", "timer"), "'Hold' as a timer label is rejected", show(strings));
    // Compliant control: a real catalog string, a data string and bare numbers.
    const okMarkup = await page.evaluate(() => {
      const t = window.RepForgeI18n.t;
      const name = JSON.parse(localStorage.getItem("repforge_v1")).program[0].name;
      return `<p id="seedCatalogOk">${t("toast.invalid_weight")}</p><p id="seedDataOk">${name}</p><p id="seedNumbersOk">3 × 7 · 102,5 kg</p>`;
    });
    const strict = await prepared(okMarkup);
    check(strict.length === 0, "a catalog string, a user/exercise name and bare figures are accepted", show(strict));
  } finally {
    await en.context.close();
  }

  // PT is the language the strings check has to survive at 360.
  const pt = await openState("pt");
  try {
    const ptCatalog = loadCatalog("pt");
    const okMarkup = await pt.page.evaluate(() => `<p id="seedPtOk">${window.RepForgeI18n.t("toast.invalid_weight")}</p>`);
    const ok = checkStrings(await seeded(pt.page, okMarkup), ptCatalog);
    check(ok.length === 0, "a Portuguese catalog string is accepted at 360", show(ok));
    const bad = checkStrings(await seeded(pt.page, "<p id=\"seedPtBad\">Regrediu</p><p id=\"seedPtEn\">Quantum flux capacitor engaged</p>"), ptCatalog);
    check(has(bad, "banned", "Regrediu") && has(bad, "not a catalog", "#seedPtEn"),
      "the PT page rejects a banned word and an English-only string", show(bad));
  } finally {
    await pt.context.close();
  }

  // ------------------------------------------------ the gate over today's app
  console.log("\nThe real gate");
  const allPending = DIRECTION_D_STATES.map((item) => ({ key: item.key, status: "pending" }));
  const pendingRun = await runGate({ states: allPending, locales: ["pt", "en"], renderPending: ["today/ready"], browser, manifest });
  check(pendingRun.ok && pendingRun.failures.length === 0, "the gate does not fail a D state that is still pending", show(pendingRun.failures));
  check(pendingRun.enforced.length === 0 && pendingRun.pending.length === 35, "with every state pending, none is enforced and 35 are pending",
    `enforced ${pendingRun.enforced.length}, pending ${pendingRun.pending.length}`);
  check(["pt", "en"].every((locale) => pendingRun.rendered.some((item) => item.key === "today/ready" && item.locale === locale)),
    "a pending sample was actually rendered in PT and EN", JSON.stringify(pendingRun.rendered));

  const built = await runGate({ states: DIRECTION_D_STATES, locales: ["pt", "en"], browser, manifest });
  const implemented = DIRECTION_D_STATES.filter((item) => item.status === "implemented").map((item) => item.key);
  check(built.ok && built.failures.length === 0, "every implemented D state passes all five checks in PT and EN at 360", show(built.failures));
  check(built.enforced.join() === implemented.join() && implemented.every((key) => ["pt", "en"].every((locale) =>
    built.rendered.some((item) => item.key === key && item.locale === locale && item.enforced))),
  "the implemented states were actually rendered and enforced in PT and EN", JSON.stringify(built.rendered));

  // A control that no R3 sub-slice rebuilds: Settings is rules-only, so flipping it must always fail.
  const flipped = await runGate({ states: [{ key: "settings/main", status: "implemented" }], locales: ["en"], browser, manifest });
  check(!flipped.ok && flipped.enforced.includes("settings/main"),
    "flipping a state that is not built to implemented enforces the checks on it and it fails", show(flipped.failures));
  const names = ["targets", "overflow", "orange", "parity", "strings"].filter((name) => flipped.failures.some((failure) => failure.includes(` ${name}: `)));
  check(["orange", "strings"].every((name) => names.includes(name)),
    "the enforced run reports failures from the individual checks", `checks that reported: ${names.join(", ")}`);

  const rotted = await runGate({ states: [{ key: "today/not-a-state", status: "pending" }], locales: ["en"], browser, manifest });
  check(!rotted.ok && has(rotted.failures, "today/not-a-state", "manifest"), "a listed state missing from the live manifest fails the gate", show(rotted.failures));
} finally {
  await browser.close();
  preview.cleanup();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed > 0 ? 1 : 0);
