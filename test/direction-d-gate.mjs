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
import { APP_SCENARIOS, APP_USER_AGENT, appState } from "../tools/ui-screens/screens-app.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { dismissChrome, setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
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
  // The reconciliation's "Retire and add list": states R3 adds to the catalog are D states from the day they exist.
  const added = doc.split("\n").filter((line) => /^\| Add \|/.test(line) && /\| R3 \|/.test(line))
    .flatMap((line) => [...line.matchAll(/`([a-z-]+\/[a-z-]+)`/g)].map((match) => match[1]));
  check(added.length >= 8, "the add list names the new R3 catalog states", `found ${added.join(", ")}`);
  const listed = DIRECTION_D_STATES.map((item) => item.key);
  check(owned.every((key) => listed.includes(key)) && listed.every((key) => owned.includes(key) || added.includes(key)) &&
    new Set(listed).size === listed.length,
  "the gate's list is the 35 treatment-table states plus only states the add list names", `${listed.length} listed`);
  const built = ["workout/focus", "workout/focus-glossary", "workout/correction",
    "workout/session", "workout/early-finish", "workout/exercise-note", "workout/warmup-actions",
    "workout/reorder", "workout/skipped-actions", "workout/substituted-actions", "history/list", "history/session",
    "program/overview", "today/ready", "today/rest-bar", "today/day-picker", "today/mixed-strategies",
    "workout/why-this-weight", "workout/why-in-session", "workout/why-rep-goal", "workout/why-anchor", "workout/why-manual",
    "session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-mixed", "session/summary-first",
    "progress/overview", "progress/overview-baseline", "progress/overview-action", "progress/strength", "progress/strength-current-block",
    "progress/strength-all-history", "progress/strength-comparison", "progress/strength-sparse", "progress/exercise-chart"];
  check(DIRECTION_D_STATES.every((item) => (item.status === "implemented") === built.includes(item.key)) &&
    DIRECTION_D_STATES.filter((item) => item.status === "implemented").length === built.length,
  "only the states an R3 sub-slice has built are implemented; every other D state is pending",
  JSON.stringify(DIRECTION_D_STATES.filter((item) => item.status === "implemented").map((item) => item.key)));
  const status = (key) => DIRECTION_D_STATES.find((item) => item.key === key)?.status;
  check(DIRECTION_D_STATES.every((item) => ["pending", "implemented"].includes(item.status)), "every D state is pending or implemented");
  check(["today/ready", "today/rest-bar", "today/day-picker", "today/mixed-strategies"].every((key) => status(key) === "implemented"),
    "R3b's Today states are enforced");
  check(["workout/why-this-weight", "workout/why-in-session", "workout/why-rep-goal", "workout/why-anchor", "workout/why-manual"].every((key) => status(key) === "implemented"),
    "R3g's Why states are enforced");
  check(["session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-mixed", "session/summary-first"].every((key) => status(key) === "implemented"),
    "R3h's session summary states are enforced");
  check(["today/done", "today/draft-resume"].every((key) => status(key) === "pending"),
    "states that still need a drawing, or whose slice has not landed, stay pending");
  // The parity oracle accepts a status's word in either vocabulary; in PT they must be the same words
  // (CONTEXT.md "Session outcome": Melhorou, Manteve, Regressou).
  const ptCatalog = JSON.parse(readFileSync(join(ROOT, "i18n-pt.json"), "utf8"));
  check(ptCatalog["delta.improved.label"] === ptCatalog["stats.outcome.improved"] && ptCatalog["delta.flat.label"] === "Manteve" &&
    ptCatalog["delta.flat.label"] === ptCatalog["stats.outcome.maintained"] && ptCatalog["delta.regressed.label"] === "Regressou" &&
    ptCatalog["delta.regressed.label"] === ptCatalog["stats.outcome.declined"],
  "the PT outcome labels agree between the delta and session-outcome vocabularies (Melhorou, Manteve, Regressou)");
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
        if (Number.isFinite(rec.load) && cmp.label) return { id: slot.id, session, label: cmp.label, status: cmp.status, load: rec.load };
      }
      return null;
    });
    check(!!probe, "the catalog lifter has an exercise with an outcome and a recommended load", JSON.stringify(probe));
    if (probe) {
      const other = probe.label === "Improved" ? "Maintained" : "Improved";
      const good = `<span id="seedOutcomeOk" data-parity-outcome="${probe.id}" data-parity-session="${probe.session}">${probe.label}</span>
        <span id="seedTargetOk" data-parity-target="${probe.id}">3 × 7 at ${String(probe.load).replace(".", ",")}</span>`;
      const okFailures = checkParity(await seeded(page, good));
      check(okFailures.length === 0, "a shown outcome word and target that match the app are accepted", show(okFailures));
      // The summary says the session-outcome word (Melhorou, Manteve, Regressou); History's page says the delta label.
      // Both are the same status; a word for another status is still rejected (below).
      const sessionWord = await page.evaluate((status) => {
        const key = { improved: "stats.outcome.improved", flat: "stats.outcome.maintained", regressed: "stats.outcome.declined" }[status];
        return key ? window.RepForgeI18n.t(key) : null;
      }, probe.status);
      if (sessionWord) {
        const viaSession = checkParity(await seeded(page, `<span id="seedOutcomeSession" data-parity-outcome="${probe.id}" data-parity-session="${probe.session}">${sessionWord}</span>`));
        check(viaSession.length === 0, `the session-outcome word (${sessionWord}) for the same status is accepted`, show(viaSession));
      }
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
    // A catalog phrase may be followed by figures and units, never by a word.
    const phrased = await prepared(await page.evaluate(() => {
      const top = window.RepForgeI18n.t("stats.metric.top_load");
      return `<p id="seedPhraseOk">${top} 102.5 kg</p><p id="seedPhraseRange">${top} 3 × 7 · 60 lb</p>`;
    }));
    check(phrased.length === 0, "a catalog phrase followed by figures and units is accepted", show(phrased));
    const phrasedBad = await prepared(await page.evaluate(() => {
      const top = window.RepForgeI18n.t("stats.metric.top_load");
      return `<p id="seedPhraseWord">${top} heavier 102.5 kg</p><p id="seedPhraseTail">${top} 102.5 kg extra</p><p id="seedPhraseDay">${top} Monday</p>`;
    }));
    check(has(phrasedBad, "not a catalog", "#seedPhraseWord") && has(phrasedBad, "not a catalog", "#seedPhraseTail") && has(phrasedBad, "not a catalog", "#seedPhraseDay"),
      "a catalog phrase followed by a non-catalog word is still rejected", show(phrasedBad));
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
  const pendingRun = await runGate({ states: allPending, locales: ["pt", "en"], renderPending: ["today/done", "workout/focus"], browser, manifest });
  check(pendingRun.ok && pendingRun.failures.length === 0, "the gate does not fail a D state that is still pending", show(pendingRun.failures));
  check(pendingRun.enforced.length === 0 && pendingRun.pending.length === DIRECTION_D_STATES.length,
    `with every state pending, none is enforced and all ${DIRECTION_D_STATES.length} are pending`,
    `enforced ${pendingRun.enforced.length}, pending ${pendingRun.pending.length}`);
  check(["today/done", "workout/focus"].every((key) => pendingRun.rendered.some((item) => item.key === key && item.locale === "pt") &&
    pendingRun.rendered.some((item) => item.key === key && item.locale === "en")),
  "the pending samples were actually rendered in PT and EN", JSON.stringify(pendingRun.rendered));

  const built = await runGate({ states: DIRECTION_D_STATES, locales: ["pt", "en"], browser, manifest });
  const implemented = DIRECTION_D_STATES.filter((item) => item.status === "implemented").map((item) => item.key);
  check(built.ok && built.failures.length === 0, "every implemented D state passes all five checks in PT and EN at 360", show(built.failures));
  check(built.enforced.join() === implemented.join() && implemented.every((key) => ["pt", "en"].every((locale) =>
    built.rendered.some((item) => item.key === key && item.locale === locale && item.enforced))),
  "the implemented states were actually rendered and enforced in PT and EN", JSON.stringify(built.rendered.map((item) => `${item.key}:${item.locale}`)));
  check(["today/ready", "today/mixed-strategies", "today/day-picker", "workout/why-this-weight", "workout/why-in-session", "workout/why-rep-goal", "workout/why-anchor", "workout/why-manual", "session/summary", "session/summary-mixed", "session/summary-first"].every((key) => ["pt", "en"].every((locale) =>
    built.rendered.some((item) => item.key === key && item.locale === locale && item.enforced))),
  "the landed Today, Why and summary states were rendered and enforced in both languages", JSON.stringify(built.rendered.map((item) => `${item.key}:${item.locale}`)));

  // A control that no R3 sub-slice rebuilds: Settings is rules-only, so flipping it must always fail.
  const flipped = await runGate({ states: [{ key: "settings/main", status: "implemented" }], locales: ["en"], browser, manifest });
  check(!flipped.ok && flipped.enforced.includes("settings/main"),
    "flipping a state that is not built to implemented enforces the checks on it and it fails", show(flipped.failures));
  const names = ["targets", "overflow", "orange", "parity", "strings"].filter((name) => flipped.failures.some((failure) => failure.includes(` ${name}: `)));
  check(["orange", "strings"].every((name) => names.includes(name)),
    "the enforced run reports failures from the individual checks", `checks that reported: ${names.join(", ")}`);

  const rotted = await runGate({ states: [{ key: "today/not-a-state", status: "pending" }], locales: ["en"], browser, manifest });
  check(!rotted.ok && has(rotted.failures, "today/not-a-state", "manifest"), "a listed state missing from the live manifest fails the gate", show(rotted.failures));

  // ------------------------------------------------ hold and recover marks (owner decision, #295)
  console.log("\nHold and recover marks");
  const markEvidence = async (key) => {
    const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-360", theme: "light", locale: "en", text: "normal", motion: "normal" };
    const opened = await openPage(browser, gate, capture, appState(key, manifest.locales.en.lang), { userAgent: APP_USER_AGENT[key] });
    try {
      await dismissChrome(opened.page);
      await APP_SCENARIOS[key](opened.page);
      await settle(opened.page);
      return await opened.page.evaluate(() => {
        const ink = document.createElement("i");
        ink.style.color = "var(--color-ink)";
        document.body.append(ink);
        const inkColor = getComputedStyle(ink).color;
        ink.remove();
        const read = (selector) => [...document.querySelectorAll(selector)].filter((node) => node.offsetParent).map((node) => {
          const glyph = node.querySelector(".verdictmark__glyph");
          const style = glyph ? getComputedStyle(glyph) : null;
          return {
            drawn: !!glyph && glyph.getBoundingClientRect().width > 0, background: style?.backgroundColor || "",
            mask: style?.webkitMaskImage || style?.maskImage || "",
          };
        });
        return {
          inkColor, hold: read(".verdictmark--hold"), recover: read(".verdictmark--recover"), up: read(".verdictmark--up"),
          todayRowHold: read("#todayExList .rxrow .verdictmark--hold").length, todayRowRecover: read("#todayExList .rxrow .verdictmark--recover").length,
          tallyHold: read(".today-tally .verdictmark--hold").length, tallyRecover: read(".today-tally .verdictmark--recover").length,
          whyHold: read("#whyTarget .verdictmark--hold").length, summaryHold: read(".sum-grp__next .verdictmark--hold").length,
          outcomes: [...document.querySelectorAll(".sum-outcome")].filter((node) => node.offsetParent).map((node) => {
            const glyph = node.querySelector(".verdictmark__glyph");
            const style = glyph ? getComputedStyle(glyph) : null;
            return {
              outcome: node.getAttribute("data-outcome"), word: node.textContent.trim(),
              drawn: !!glyph && glyph.getBoundingClientRect().width > 0, background: style?.backgroundColor || "",
              mask: style?.webkitMaskImage || style?.maskImage || "",
            };
          }),
          rowMarks: [...document.querySelectorAll("#todayExList .rxrow")].map((row) => ({
            name: row.querySelector(".rxrow__name")?.firstChild?.textContent?.trim(),
            mark: [...row.querySelectorAll(".verdictmark")].map((mark) => mark.className.replace(/.*verdictmark--/, "")).join(","),
          })),
        };
      });
    } finally {
      await opened.context.close();
    }
  };
  const today = await markEvidence("today/mixed-strategies");
  check(today.todayRowHold > 0 && today.todayRowRecover > 0, "Today's prescription rows draw a hold mark and a recover mark",
    JSON.stringify(today.rowMarks));
  check(today.tallyHold > 0 && today.tallyRecover > 0, "the Today tally draws them too");
  check(today.hold.length > 0 && today.recover.length > 0 && [...today.hold, ...today.recover].every((mark) => mark.drawn && mark.background === today.inkColor),
    "hold and recover are drawn in ink", JSON.stringify([...today.hold, ...today.recover].map((mark) => mark.background)));
  check(today.up.length > 0 && today.up.every((mark) => mark.background !== today.inkColor),
    "the up mark is still the only accent mark", JSON.stringify(today.up.map((mark) => mark.background)));
  check(today.hold[0].mask !== "none" && today.recover[0].mask !== "none" && today.hold[0].mask !== today.recover[0].mask,
    "hold is drawn \"=\" and recover a return arrow: two distinct drawn glyphs");
  check(today.rowMarks.filter((row) => !row.mark).length >= 1 && today.rowMarks.every((row) => !/stalled|new|manual/.test(row.mark)),
    "stalled, new and manual rows stay word-only (no mark)", JSON.stringify(today.rowMarks));
  const why = await markEvidence("workout/why-rep-goal");
  check(why.whyHold === 1 && why.hold.every((mark) => mark.drawn && mark.background === why.inkColor),
    "the Why headline draws the hold mark in ink", JSON.stringify(why.hold));
  const summary = await markEvidence("session/summary-mixed");
  check(summary.summaryHold > 0 && summary.hold.every((mark) => mark.drawn && mark.background === summary.inkColor),
    "the summary's next target draws the hold mark in ink", JSON.stringify(summary.hold));

  // ------------------------------------------------ maintained outcome mark (owner decision, #295)
  console.log("\nMaintained outcome mark");
  const maintained = await markEvidence("session/summary-maintained");
  const declined = await markEvidence("session/summary-declined");
  const outcomeOf = (evidence, name) => evidence.outcomes.filter((mark) => mark.outcome === name);
  const keep = outcomeOf(maintained, "maintained");
  const rise = [...outcomeOf(maintained, "improved"), ...outcomeOf(summary, "improved")];
  const fall = outcomeOf(declined, "declined");
  check(keep.length > 0 && keep.every((mark) => mark.drawn && mark.background === maintained.inkColor && mark.mask !== "none"),
    "the maintained outcome draws a glyph, in ink and never the accent", JSON.stringify(keep));
  check(keep.length > 0 && rise.length > 0 && fall.length > 0, "the summary states carry maintained, improved and declined words",
    JSON.stringify({ keep: keep.length, rise: rise.length, fall: fall.length }));
  check(keep.every((mark) => mark.mask === maintained.hold[0]?.mask || mark.mask === summary.hold[0]?.mask),
    "maintained draws the same \"=\" as the hold recommendation: one meaning per glyph", JSON.stringify({ keep: keep[0]?.mask, hold: summary.hold[0]?.mask }));
  check(rise.length > 0 && fall.length > 0 && keep.every((mark) => [...rise, ...fall].every((other) => other.mask !== mark.mask)),
    "maintained is distinct from the up and down arrows", JSON.stringify({ keep: keep[0]?.mask, rise: rise[0]?.mask, fall: fall[0]?.mask }));
  check(rise.every((mark) => mark.drawn && mark.background !== maintained.inkColor) && fall.every((mark) => mark.drawn && mark.background === declined.inkColor),
    "improved stays the only accent mark and declined stays ink", JSON.stringify({ rise: rise.map((mark) => mark.background), fall: fall.map((mark) => mark.background) }));
} finally {
  await browser.close();
  preview.cleanup();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed > 0 ? 1 : 0);
