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
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState } from "../tools/ui-screens/screens-app.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { dismissChrome, setCaptureBase, launchChromium, openPage, settle } from "../tools/ui-screens/session.mjs";
import {
  DIRECTION_D_STATES, GAPS, ORANGE_ALLOWLIST, ORANGE_CATEGORIES, TIMER_SCOPES, checkOrange, checkOverflow, checkParity, checkStrings,
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
const PT_REPS_PER_SIDE_LABEL = loadCatalog("pt").dictionary["focus.metric.reps_per_side"];
if (typeof PT_REPS_PER_SIDE_LABEL !== "string" || !PT_REPS_PER_SIDE_LABEL.trim() || !/\breps\b/iu.test(PT_REPS_PER_SIDE_LABEL)) {
  throw new Error("the PT per-side label fixture must be a nonempty catalog phrase containing the overlapping raw metric name");
}

async function verifyProgressStrengthReader(browser) {
  const key = "progress/strength-comparison";
  const capture = { flow: "progress", screen: "strength-comparison", viewport: "phone-360", theme: "light", locale: "en", text: "normal", motion: "normal" };
  const opened = await openPage(browser, gate, capture, appState(key, manifest.locales.en.lang), {
    userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key],
  });
  try {
    await dismissChrome(opened.page);
    await APP_SCENARIOS[key](opened.page);
    await settle(opened.page);
    const correctEvidence = await gatherEvidence(opened.page, { scope: "#stats" });
    const readerOutcomes = correctEvidence.parity.outcomes.filter(item => item.reader === "progress-strength");
    const improvedWord = await opened.page.evaluate(() => window.RepForgeI18n.t("stats.outcome.improved"));
    const improved = readerOutcomes.find(item => item.expected === improvedWord);
    check(readerOutcomes.length > 0 && readerOutcomes.every(item => item.scope === "current-block" && item.convention),
      "the real Progress outcome identifies its saved-session scope and convention for the parity oracle", JSON.stringify(readerOutcomes));
    check(!!improved && improved.text === improved.expected && checkParity(correctEvidence).length === 0,
      "the heavier same-convention per-side session agrees with the authoritative reader comparison", JSON.stringify(improved));

    const exerciseId = improved?.exerciseId;
    const marker = opened.page.locator(`#strengthDash [data-parity-outcome="${exerciseId}"]`);
    if (improved) {
      await marker.evaluate(node => node.removeAttribute("data-parity-convention"));
      const missingEvidence = await gatherEvidence(opened.page, { scope: "#stats" });
      const missingFailures = checkParity(missingEvidence);
      check(missingFailures.some(failure => failure.includes("incomplete Progress strength reader context")),
        "the parity oracle rejects a Progress outcome with missing convention context", show(missingFailures));

      await marker.evaluate((node, context) => {
        node.setAttribute("data-parity-convention", context.convention);
        node.setAttribute("data-parity-scope", "unreviewed-scope");
      }, { convention: improved.convention });
      const invalidEvidence = await gatherEvidence(opened.page, { scope: "#stats" });
      const invalidFailures = checkParity(invalidEvidence);
      check(invalidFailures.some(failure => failure.includes("unsupported Progress strength scope unreviewed-scope")),
        "the parity oracle rejects an unsupported Progress scope context", show(invalidFailures));

      const wrongWord = await opened.page.evaluate(() => window.RepForgeI18n.t("delta.not_comparable.label"));
      await marker.evaluate((node, context) => {
        node.setAttribute("data-parity-reader", "progress-strength");
        node.setAttribute("data-parity-scope", context.scope);
        node.setAttribute("data-parity-convention", context.convention);
        node.textContent = window.RepForgeI18n.t("delta.not_comparable.label");
      }, { scope: improved.scope, convention: improved.convention });
      const wrongEvidence = await gatherEvidence(opened.page, { scope: "#stats" });
      const wrongFailures = checkParity(wrongEvidence);
      check(wrongFailures.some(failure => failure.includes("outcome word") && failure.includes(`reads "${wrongWord}"`)
        && failure.includes(`says "${improved.expected}"`)),
      "the Progress reader parity gate rejects a deliberately wrong rendered saved-session outcome", show(wrongFailures));
    } else {
      check(false, "the parity oracle rejects a Progress outcome with missing convention context", "no improved outcome was available");
      check(false, "the parity oracle rejects an unsupported Progress scope context", "no improved outcome was available");
      check(false, "the Progress reader parity gate rejects a deliberately wrong rendered saved-session outcome", "no improved outcome was available");
    }
  } finally {
    await opened.context.close();
  }
}

if (process.argv.includes("--progress-reader-only")) {
  const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
  setCaptureBase(preview.env.REPFORGE_URL);
  const browser = await launchChromium();
  try {
    await verifyProgressStrengthReader(browser);
  } finally {
    await browser.close();
    preview.cleanup();
  }
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

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
  // Plan 067 retired the per-exercise progression strategies (rep_goal, anchor_backoff) the
  // mixed-strategies day existed to demonstrate: the adaptive engine now recommends sets
  // uniformly, so these four treatment-table/add-list states no longer exist as screens.
  const RETIRED_D_STATES = new Set([
    "today/mixed-strategies", "workout/why-rep-goal", "workout/why-anchor", "session/summary-mixed",
  ]);
  const ownedCurrent = owned.filter((key) => !RETIRED_D_STATES.has(key));
  const addedCurrent = added.filter((key) => !RETIRED_D_STATES.has(key));
  const listed = DIRECTION_D_STATES.map((item) => item.key);
  check(ownedCurrent.every((key) => listed.includes(key)) && listed.every((key) => ownedCurrent.includes(key) || addedCurrent.includes(key)) &&
    new Set(listed).size === listed.length,
  "the gate's list is the 35 treatment-table states, minus Plan 067's retired strategy-engine states, plus only states the add list names",
  `${listed.length} listed`);
  const built = ["workout/focus", "workout/focus-glossary", "workout/correction", "workout/rest-running", "workout/rest-done",
    "workout/session", "workout/early-finish", "workout/exercise-note", "workout/warmup-actions",
    "workout/reorder", "workout/skipped-actions", "workout/substituted-actions", "history/list", "history/session",
    "history/edit-dirty", "history/edit-invalid",
    "program/overview", "today/ready", "today/rest-bar", "today/day-picker", "today/draft-resume",
    "today/done", "workout/exercise-actions",
    "workout/why-this-weight", "workout/why-in-session", "workout/why-manual",
    "session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-first",
    "progress/overview", "progress/overview-baseline", "progress/overview-action", "progress/strength", "progress/strength-current-block",
    "progress/strength-all-history", "progress/strength-comparison", "progress/strength-sparse", "progress/exercise-chart"];
  check(DIRECTION_D_STATES.every((item) => (item.status === "implemented") === built.includes(item.key)) &&
    DIRECTION_D_STATES.filter((item) => item.status === "implemented").length === built.length,
  "only the states an R3 sub-slice has built are implemented, and with R3x that is every listed D state",
  JSON.stringify(DIRECTION_D_STATES.filter((item) => item.status === "implemented").map((item) => item.key)));
  const status = (key) => DIRECTION_D_STATES.find((item) => item.key === key)?.status;
  check(DIRECTION_D_STATES.every((item) => ["pending", "implemented"].includes(item.status)), "every D state is pending or implemented");
  check(["today/ready", "today/rest-bar", "today/day-picker", "today/draft-resume"].every((key) => status(key) === "implemented"),
    "R3b's Today states and R3b2's unfinished-session state are enforced");
  check(["history/edit-dirty", "history/edit-invalid"].every((key) => status(key) === "implemented"),
    "R3j2's History edit states, the unsaved editor and an invalid value, are enforced");
  check(["workout/why-this-weight", "workout/why-in-session", "workout/why-manual"].every((key) => status(key) === "implemented"),
    "R3g's Why states are enforced");
  check(["session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-first"].every((key) => status(key) === "implemented"),
    "R3h's session summary states are enforced");
  check(["workout/rest-running", "workout/rest-done"].every((key) => status(key) === "implemented") &&
    !DIRECTION_D_STATES.some((item) => /^workout\/rest-timer/.test(item.key)),
  "the rest states (the tab, running and run out) are enforced, and the R3f-retired rest-timer states are in no gate list");
  check(["today/done", "workout/exercise-actions"].every((key) => status(key) === "implemented"),
    "R3x's last two approved states, the finished day and the redrawn exercise actions, are enforced");
  check(DIRECTION_D_STATES.every((item) => item.status === "implemented"),
    "no D state is pending: every state the drawing rounds approved is built and enforced");
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
  // Direction D's five uses, plus the bar's text button the owner approved with the bar-actions mock (2026-10-23),
  // Today's live session card the owner approved with mock A (2026-10-23), the rest timer, and the Focus hero's Why?
  // action (direction A of focus-hero.html, 2026-10-28).
  check(ORANGE_CATEGORIES.length === 9 && ORANGE_CATEGORIES.includes("bar-text-button") && ORANGE_CATEGORIES.includes("live-session") && ORANGE_CATEGORIES.includes("rest-timer")
    && ORANGE_CATEGORIES.includes("focus-hero-why"),
    "the orange budget names exactly nine categories", ORANGE_CATEGORIES.join(", "));
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
    // The running rest's drain (rest timer redesign): the light along the shelf's contour is the budget's timer use;
    // accent on the tab's running label is not.
    const drainMarkup = `<div class="focus-shelf" id="seedRest" style="position:relative"><svg class="restlight" width="300" height="40" style="position:absolute;top:0;left:0"><path class="restlight__core" id="seedDrainFill" d="M0,34 A20,20 0 0 1 20,14 H300" style="stroke:var(--accent);stroke-width:1.25;fill:none"/></svg>
        <button type="button" class="resttab"><span class="resttab__label" id="seedRestLabel" style="color:var(--accent)">Rest</span><span class="resttab__time" id="seedRestClock">1:30</span></button></div>`;
    const drainEmpty = checkOrange(await seeded(page, drainMarkup, { allowlist: [] }));
    check(has(drainEmpty, "orange", "#seedDrainFill"), "the drain's light is accent paint and is rejected when it is not on the list", show(drainEmpty));
    const drainReal = checkOrange(await seeded(page, drainMarkup));
    check(!has(drainReal, "#seedDrainFill"), "the drain's light is accepted by the gate's own allowlist (timer-drain-bar)", show(drainReal));
    check(has(drainReal, "orange", "#seedRestLabel") && !has(drainReal, "#seedRestClock"),
      "only the drain is orange budget while the rest runs: accent on the tab's label is rejected and the ink time is accepted", show(drainReal));
    check(ORANGE_ALLOWLIST.some((entry) => entry.category === "timer-drain-bar" && entry.selector === ".restlight__core" && !entry.pseudo),
      "the drain entry sits under the running timer's drain bar category and names the light's core, not the shelf");
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
        <span id="seedTargetOk" data-parity-target="${probe.id}">3 × 7 at ${String(probe.load).replace(".", ",")} kg</span>`;
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
      const wrongLoad = checkParity(await seeded(page, `<span id="seedTargetBad" data-parity-target="${probe.id}">3 × 7 at ${probe.load + 2.5} kg</span>`));
      check(has(wrongLoad, "parity", "#seedTargetBad"), "a target that differs from recommendation() is rejected", show(wrongLoad));
      // STD-1: the load is the marked element's own load figure, not any number that happens to equal it.
      const fmtKg = (value) => String(value).replace(".", ",");
      const coincidence = checkParity(await seeded(page,
        `<span id="seedTargetCoincide" data-parity-target="${probe.id}">3 × ${probe.load} at ${probe.load + 100} kg</span>`));
      check(has(coincidence, "parity", "#seedTargetCoincide"),
        "STD-1: a wrong load is rejected when another number in the marked text equals the recommendation (3 × L at L+100 kg)", show(coincidence));
      const repsCoincide = checkParity(await seeded(page,
        `<span id="seedTargetReps" data-parity-target="${probe.id}">${probe.load + 100} kg × ${Math.round(probe.load)}</span>`));
      check(has(repsCoincide, "parity", "#seedTargetReps"),
        "STD-1: a wrong load is rejected when the reps figure equals the recommendation", show(repsCoincide));
      const ambiguous = checkParity(await seeded(page,
        `<span id="seedTargetBare" data-parity-target="${probe.id}">3 × ${probe.load}</span>`));
      check(has(ambiguous, "parity", "#seedTargetBare"),
        "STD-1: several bare figures with no unit cannot say which is the load and are rejected", show(ambiguous));
      const otherUnit = checkParity(await seeded(page,
        `<span id="seedTargetUnit" data-parity-target="${probe.id}">${fmtKg(probe.load)} lb × 8</span>`));
      check(has(otherUnit, "parity", "#seedTargetUnit"),
        "STD-1: a load figure in the other unit is rejected (the app shows kg here)", show(otherUnit));
      const goodForms = checkParity(await seeded(page,
        `<span id="seedTargetUnitOk" data-parity-target="${probe.id}">${fmtKg(probe.load)} kg × 8, 8</span>
         <span id="seedTargetDotOk" data-parity-target="${probe.id}">Next: ${probe.load} kg × 3</span>
         <span id="seedTargetBareOk" data-parity-target="${probe.id}">${fmtKg(probe.load)}</span>
         <span id="seedTargetArrowOk" data-parity-target="${probe.id}">${probe.load - 2.5}→${fmtKg(probe.load)} kg</span>`));
      check(goodForms.length === 0, "STD-1: the shapes the app prints (load and unit, a bare load, last→next with the unit) are accepted", show(goodForms));
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
      <div class="resttab"><span id="seedHold">Hold</span></div>
      <div id="restSheet"><span id="seedHoldPad" aria-label="Hold">Hold</span></div>
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
    check(has(strings, "banned", "Hold", "timer", "at #seedHold:"), "'Hold' as a timer label is rejected on the rest tab", show(strings));
    check(has(strings, "banned", "Hold", "timer", "at #seedHoldPad:"), "'Hold' in the rest sheet is rejected", show(strings));
    // The floating pill is retired (owner, 2026-10-29): a rest only runs inside a session, read on the tab or the sheet.
    check(TIMER_SCOPES.length === 2 && TIMER_SCOPES.includes(".resttab") && TIMER_SCOPES.includes("#restSheet"),
    "the timer scopes name the rest tab and the rest sheet (which holds the dial)", TIMER_SCOPES.join(", "));
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
    const sideMetricLabel = PT_REPS_PER_SIDE_LABEL;
    const sideMetricMarkup = `<p id="seedSideMetric">${sideMetricLabel}</p>`;
    const sideMetricEvidence = await seeded(pt.page, sideMetricMarkup);
    // The production per-side fixture persists the English metric source name alongside PT UI copy.
    sideMetricEvidence.data.strings.push("Reps", "reps");
    const sideMetricFailures = checkStrings(sideMetricEvidence, ptCatalog);
    check(sideMetricFailures.length === 0, "a raw metric name does not erase a matching rendered PT catalog phrase", show(sideMetricFailures));
    const sideMetricBadEvidence = await seeded(pt.page, `<p id="seedSideMetricBad">${sideMetricLabel} improvised</p>`);
    sideMetricBadEvidence.data.strings.push("Reps", "reps");
    const sideMetricBad = checkStrings(sideMetricBadEvidence, ptCatalog);
    check(has(sideMetricBad, "not a catalog", "#seedSideMetricBad"),
      "the same raw metric name cannot hide an unreviewed word after a PT catalog phrase", show(sideMetricBad));
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
  check(["workout/rest-running", "workout/rest-done"].every((key) => ["pt", "en"].every((locale) =>
    built.rendered.some((item) => item.key === key && item.locale === locale && item.enforced))),
  "the rest states were rendered and enforced in both languages", JSON.stringify(built.rendered.filter((item) => /rest-/.test(item.key))));
  check(["today/ready", "today/day-picker", "workout/why-this-weight", "workout/why-in-session", "workout/why-manual", "session/summary", "session/summary-first"].every((key) => ["pt", "en"].every((locale) =>
    built.rendered.some((item) => item.key === key && item.locale === locale && item.enforced))),
  "the landed Today, Why and summary states were rendered and enforced in both languages", JSON.stringify(built.rendered.map((item) => `${item.key}:${item.locale}`)));

  // Progress's saved-session reader projects logged metric values before it
  // compares sessions. Exercise the same real generated state here, then
  // deliberately corrupt one rendered word to prove the oracle still rejects
  // a mismatch for that explicit reader context.
  console.log("\nProgress strength reader parity");
  await verifyProgressStrengthReader(browser);

  // Controls that no R3 sub-slice rebuilds: Settings and Library are rules-only, so flipping them must fail. After the
  // R6a sweep Settings paints no accent, so it reports the strings check; Library's sideways filter rails still overflow.
  const flipped = await runGate({
    states: [{ key: "settings/main", status: "implemented" }, { key: "library/list", status: "implemented" }], locales: ["en"], browser, manifest,
  });
  check(!flipped.ok && flipped.enforced.includes("settings/main") && flipped.enforced.includes("library/list"),
    "flipping a state that is not built to implemented enforces the checks on it and it fails", show(flipped.failures));
  const names = ["targets", "overflow", "orange", "parity", "strings"].filter((name) => flipped.failures.some((failure) => failure.includes(` ${name}: `)));
  check(["overflow", "strings"].every((name) => names.includes(name)),
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
  // PLAN 067 GAP: today/mixed-strategies, workout/why-rep-goal and session/summary-mixed
  // were the catalog's only demonstration of a hold mark and a recover mark together (the
  // mixed day deliberately carried a stalled rep_goal lift and a recovering anchor_backoff
  // lift). Plan 067 retired those per-exercise progression strategies and their fixture; the
  // hold/recover mark drawing rule itself is still live product behavior (the adaptive engine
  // can still recommend holding or backing off a lift), but proving it needs a canonical
  // generated-program fixture with real history that produces those verdicts, which does not
  // exist yet. Recording this as a known gap rather than asserting against a removed state.
  console.log("  ! today/mixed-strategies, workout/why-rep-goal, session/summary-mixed are retired;"
    + " the hold/recover mark proof needs a canonical adaptive-engine fixture (not yet built) to replace them");

  // ------------------------------------------------ maintained outcome mark (owner decision, #295)
  console.log("\nMaintained outcome mark");
  const maintained = await markEvidence("session/summary-maintained");
  const declined = await markEvidence("session/summary-declined");
  // today/ready's own prescription tally is the hold-glyph reference now that the
  // mixed-strategies day (the previous source of a guaranteed hold mark) is retired.
  const ready = await markEvidence("today/ready");
  const outcomeOf = (evidence, name) => evidence.outcomes.filter((mark) => mark.outcome === name);
  const keep = outcomeOf(maintained, "maintained");
  const rise = outcomeOf(maintained, "improved");
  const fall = outcomeOf(declined, "declined");
  check(keep.length > 0 && keep.every((mark) => mark.drawn && mark.background === maintained.inkColor && mark.mask !== "none"),
    "the maintained outcome draws a glyph, in ink and never the accent", JSON.stringify(keep));
  check(keep.length > 0 && rise.length > 0 && fall.length > 0, "the summary states carry maintained, improved and declined words",
    JSON.stringify({ keep: keep.length, rise: rise.length, fall: fall.length }));
  const holdMask = maintained.hold[0]?.mask || ready.hold[0]?.mask;
  check(!!holdMask && keep.every((mark) => mark.mask === holdMask),
    "maintained draws the same \"=\" as the hold recommendation: one meaning per glyph", JSON.stringify({ keep: keep[0]?.mask, hold: holdMask }));
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
