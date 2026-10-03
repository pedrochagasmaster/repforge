#!/usr/bin/env node
/**
 * Direction D real-app acceptance gate (Plan 064 R3a, Plan 063 P3a).
 *
 * The review page's five acceptance checks (docs/design/direction-d-
 * implementation-spec.md section 10), run against the real app's catalog
 * states in PT and EN at 360 CSS px:
 *
 *   1. targets   every `button, a, input, [role=button]` is at least 44 x 44.
 *   2. overflow  no element is wider than its box except the tab row, and no
 *                `text-overflow: ellipsis` on a D surface.
 *   3. orange    every element painted with the accent is on the orange budget.
 *   4. parity    every outcome word equals `compareExerciseSession`; every
 *                shown target equals `recommendation()`.
 *   5. strings   no banned word; every rendered string is a catalog key.
 *
 * Enforcement follows DIRECTION_D_STATES. A state is `pending` until the R3
 * sub-slice that builds it flips it to `implemented`; the gate enforces the
 * checks only on implemented states, and it fails when a listed state is not
 * in the live manifest so the list cannot rot. Rules that no governing
 * document provides are recorded in GAPS and left explicit, never invented.
 *
 * Usage:
 *   node tools/check-direction-d.mjs                      validate the list; enforce implemented states
 *   node tools/check-direction-d.mjs --state today/ready  also render a pending state (not enforced)
 *   node tools/check-direction-d.mjs --state today/ready --enforce
 *                                                         enforce the checks on that state anyway (diagnostic)
 *   options: --locale pt|en  --theme light|dark  --verbose
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadManifest } from "./ui-screens/manifest.mjs";
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState } from "./ui-screens/screens-app.mjs";
import { dismissChrome, launchChromium, openPage, setCaptureBase, settle } from "./ui-screens/session.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
import { validateCatalogEvidence } from "./ui-screens/catalog-contract.mjs";

/** Spec section 10 checks every control "at 360". The manifest has no 360 viewport; the gate adds it to a copy. */
export const GATE_VIEWPORT = Object.freeze({ width: 360, height: 780, label: "Direction D acceptance width (spec section 10)" });
export function gateManifest(manifest) {
  return { ...manifest, viewports: { ...manifest.viewports, "phone-360": { ...GATE_VIEWPORT } } };
}

/**
 * The 35 screens whose treatment is `redesign (D)` in the "Surface treatment
 * table" of docs/design/plan-064-reconciliation.md. An R3 sub-slice flips its
 * states to `implemented` in the commit that lands them.
 */
const D_STATE_KEYS = [
  "today/ready", "today/rest-bar", "today/day-picker", "today/done", "today/draft-resume",
  "workout/focus", "workout/focus-glossary", "workout/exercise-note", "workout/why-this-weight", "workout/session",
  "workout/early-finish", "workout/exercise-actions", "workout/warmup-actions", "workout/reorder",
  "workout/correction", "workout/skipped-actions", "workout/substituted-actions",
  "session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-mixed",
  "progress/overview", "progress/overview-baseline", "progress/overview-action", "progress/exercise-chart",
  "progress/strength", "progress/strength-current-block", "progress/strength-all-history",
  "progress/strength-comparison", "progress/strength-sparse",
  "history/list", "history/session", "history/edit-dirty", "history/edit-invalid",
  "program/overview",
];
/** States an R3 sub-slice has built; the gate enforces these and only these. */
const IMPLEMENTED_D_STATES = new Set([
  // R3c: the Focus surface (shelf, ledger, cue, header routes) over DraftV2.
  "workout/focus", "workout/focus-glossary", "workout/correction",
  // R3f: the inline rest in the Focus cue slot and pad row, running and run out.
  "workout/rest-running", "workout/rest-done",
  // R3d: the workout sheets drawn in OG-6 round 1.
  "workout/session", "workout/early-finish", "workout/exercise-note", "workout/warmup-actions",
  "workout/reorder", "workout/skipped-actions", "workout/substituted-actions",
  // R3j: History's week list with the frequency counts and the calendar sheet, and the session page.
  "history/list", "history/session",
  // R3j2: the History editor (unsaved changes, the discard question as a sheet) and an invalid value keeping its reason.
  "history/edit-dirty", "history/edit-invalid",
  // R3k: the Program overview as a ledger (readiness retired).
  "program/overview",
  // R3b: Today, the prescription table, the day picker and the mixed-strategies day.
  "today/ready", "today/rest-bar", "today/day-picker", "today/mixed-strategies",
  // R3b2: Today with an unfinished session, the status band drawn in OG-6 round 1.
  "today/draft-resume",
  // R3x: the last two owner-approved states. today/done is the finished day drawn in OG-6 round 1; workout/exercise-actions
  // is the round 2 redraw (reorder and finish early live on the session sheet only).
  "today/done", "workout/exercise-actions",
  // R3g: Why this weight, the five states, enforced on the sheet (STATE_SCOPES).
  "workout/why-this-weight", "workout/why-in-session", "workout/why-rep-goal", "workout/why-anchor", "workout/why-manual",
  // R3h: the session summary, the five states, enforced on #sessionSummary (STATE_SCOPES).
  "session/summary", "session/summary-maintained", "session/summary-declined", "session/summary-mixed", "session/summary-first",
  // R3i: Progress's single tab row, the overview, its attention and strength rows, the Strength tab and the exercise chart.
  "progress/overview", "progress/overview-baseline", "progress/overview-action", "progress/exercise-chart",
  "progress/strength", "progress/strength-current-block", "progress/strength-all-history",
  "progress/strength-comparison", "progress/strength-sparse",
]);
/**
 * Drawn states the Plan 064 R3 sub-slices add to the catalog (reconciliation
 * "Retire and add list"). They are Direction D states from the day they exist.
 */
const D_ADDED_STATE_KEYS = [
  "today/mixed-strategies",
  "workout/why-in-session", "workout/why-rep-goal", "workout/why-anchor", "workout/why-manual",
  "session/summary-first",
  "workout/rest-running", "workout/rest-done",
];
/**
 * A sheet state is enforced on the sheet: the page behind it belongs to another
 * R3 sub-slice (Focus) and is enforced when that slice lands.
 */
export const STATE_SCOPES = Object.freeze({
  "workout/why-this-weight": "#whySheet", "workout/why-in-session": "#whySheet",
  "workout/why-rep-goal": "#whySheet", "workout/why-anchor": "#whySheet", "workout/why-manual": "#whySheet",
  "session/summary": "#sessionSummary", "session/summary-maintained": "#sessionSummary", "session/summary-declined": "#sessionSummary",
  "session/summary-mixed": "#sessionSummary", "session/summary-first": "#sessionSummary",
});
export const DIRECTION_D_STATES = [...D_STATE_KEYS, ...D_ADDED_STATE_KEYS].map((key) => ({ key, status: IMPLEMENTED_D_STATES.has(key) ? "implemented" : "pending" }));

/** Plan 064 section 8.8 / Direction D spec section 7: the only uses of the accent. */
export const ORANGE_CATEGORIES = Object.freeze([
  "verdict-glyph", "current-exercise-segment", "timer-drain-bar", "cta-arrow", "active-dock-icon",
]);
/**
 * [{ category, selector, pseudo?: "::before" | "::after" }]. Each R3 sub-slice adds the entries its
 * states paint (see GAPS: the entries are the slice's reading of the budget, for owner approval).
 */
export const ORANGE_ALLOWLIST = [
  // R3c: the current exercise's segment in Focus's exercise bar (the bar inside the segment button).
  { category: "current-exercise-segment", selector: "#woProgress .segbar__seg.is-current .segbar__bar" },
  // R3c: Next exercise is a navigation, so its CTA keeps the arrow (the only arrow a Focus state can show).
  { category: "cta-arrow", selector: ".focus-shelf .btn--cta[data-fnext]", pseudo: "::after" },
  // R3c: the up verdict glyph beside the cue.
  { category: "verdict-glyph", selector: ".verdictmark--up .verdictmark__glyph" },
  // R3b: Today's Start workout CTA keeps its arrow.
  { category: "cta-arrow", selector: ".btn--cta", pseudo: "::after" },
  // R3f: the running rest's drain bar (the bar's fill, a transform on a 4px track).
  { category: "timer-drain-bar", selector: ".restinline__fill" },
  // R3j: the dock's active item. Direction D leaves the dock as shipped (spec section 7), so the
  // active tab keeps painting its icon, its label and its selection edge in the accent.
  { category: "active-dock-icon", selector: "nav button.active .nav__icon" },
  { category: "active-dock-icon", selector: "nav button.active > [data-i18n]" },
  { category: "active-dock-icon", selector: "nav button.active" },
];
/** [{ id, selector }]. Empty on purpose: see GAPS. */
export const OVERFLOW_EXCEPTIONS = [
  // R3i: Direction D's single Progress tab row scrolls sideways when five tabs do not fit (spec section 4.6).
  { id: "progress-tab-row", selector: ".tabrow" },
];
/** Where "Hold" as a label is banned: the rest surfaces. R3f: the inline block, its pad row and the presets sheet. */
export const TIMER_SCOPES = ["#restSheet", ".restinline", ".shelf__pads--rest"];

/** Data attributes a D surface emits so parity can tie a rendered word or figure to an exercise (see GAPS). */
export const PARITY_ATTRIBUTES = Object.freeze({ outcome: "data-parity-outcome", session: "data-parity-session", target: "data-parity-target" });

export const GAPS = Object.freeze([
  "Orange allowlist: Plan 064 section 8.8 and the D spec section 7 name five permitted uses (verdict glyph, current exercise segment, running timer's drain bar, CTA arrow, active dock icon) but no governing document binds any of them to a selector or pseudo-element. ORANGE_ALLOWLIST therefore holds only what each R3 sub-slice adds for the states it enforces (R3b: the up verdict glyph, the CTA arrow, and the active dock item's ring, icon and label); every entry is the sub-slice's reading of the budget and is listed in its handoff for the owner to approve. Every budget use now has an element (R3f added the running timer's drain bar, the inline rest's fill).",
  "Overflow exception: the spec excepts 'the tab row' but D's single tab row has no selector until R3 builds it (spec section 4.6). OVERFLOW_EXCEPTIONS is empty, so a scrolling tab row fails until the Progress sub-slice adds its entry. 'D surfaces' for the ellipsis rule is read as the whole rendered page of a D-owned state.",
  "Parity markup: no governing document says how a rendered outcome word or target is tied to an exercise. The gate defines the minimum: data-parity-outcome=<exerciseId> (optional data-parity-session=<sessionId>, default the latest logged session) on the element whose text is the outcome word, and data-parity-target=<exerciseId> on the element that shows the target; an unmarked element whose own text equals a delta.*.label is an orphan outcome word. The contract needs orchestrator approval before R3 sub-slices emit it. Targets compare the load only: recommendation() carries no reps, and the per-set reps come from setSuggestion, which the spec's section 10 does not name.",
  "Banned words: the governing documents name only 'Regrediu', 'Hold' as a timer label and em dashes (D spec section 6, strings appendix), plus the brand guide's curly-quote and Portuguese-English-word rules that test/i18n.mjs enforces. There is no single banned-word list. The gate duplicates the patterns from test/i18n.mjs (it runs its assertions on import and cannot be imported), so they can drift. 'Timer label' is scoped to TIMER_SCOPES.",
  "Strings: 'every rendered string is a catalog key' is implemented as: raw keys, unresolved tokens and requested-but-missing keys (reusing tools/ui-screens/catalog-contract.mjs) fail; any other string with letters must match a catalog value for the page language (a {token} matches any text), or be made only of user or exercise data from the durable state and the exercise library, numbers, the unit labels kg and lb, and weekday or month names for the page language. The data and unit exclusions are this gate's reading of 'data such as a number, exercise name or user text'; the brief gave no precise rule.",
]);

export function validateStateList(states, manifest) {
  const problems = [];
  const live = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  const seen = new Set();
  for (const item of states) {
    if (!item || typeof item.key !== "string") { problems.push("a listed D state has no key"); continue; }
    if (!live.has(item.key)) problems.push(`listed D state ${item.key} is not in the live manifest (docs/ui-screens/manifest.json); retire it from the list or restore the screen`);
    if (seen.has(item.key)) problems.push(`duplicate D state ${item.key}`);
    seen.add(item.key);
    if (!["pending", "implemented"].includes(item.status)) problems.push(`D state ${item.key} has status ${JSON.stringify(item.status)}; use pending or implemented`);
  }
  return problems;
}

export function validateGateConfig({ allowlist = ORANGE_ALLOWLIST, exceptions = OVERFLOW_EXCEPTIONS } = {}) {
  const problems = [];
  const tooBroad = (selector) => typeof selector !== "string" || !selector.trim() || ["*", "body", "html"].includes(selector.trim()) || /(^|[\s>+~])\*$/.test(selector.trim());
  for (const entry of allowlist) {
    if (!ORANGE_CATEGORIES.includes(entry.category)) problems.push(`orange allowlist entry ${entry.selector}: category ${JSON.stringify(entry.category)} is not one of ${ORANGE_CATEGORIES.join(", ")}`);
    if (tooBroad(entry.selector)) problems.push(`orange allowlist entry ${JSON.stringify(entry.selector)} is empty or too broad`);
    if (entry.pseudo !== undefined && !["::before", "::after"].includes(entry.pseudo)) problems.push(`orange allowlist entry ${entry.selector}: pseudo must be ::before or ::after`);
  }
  for (const entry of exceptions) {
    if (!entry.id || tooBroad(entry.selector)) problems.push(`overflow exception ${JSON.stringify(entry.id)} needs an id and a specific selector`);
  }
  return problems;
}

export function loadCatalog(lang) {
  const dictionary = JSON.parse(readFileSync(join(ROOT, `i18n-${lang}.json`), "utf8"));
  const keys = Object.keys(dictionary);
  const namespaces = [...new Set(keys.flatMap((key) => key.split(".").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("."))))];
  return { lang, dictionary, keys, namespaces };
}

/**
 * Runs in the page. Everything the five checks need, measured from the
 * rendered DOM inside `options.scope` (default the whole body). Self-contained
 * because Playwright serializes it.
 */
export function collectGateEvidence(options = {}) {
  const scope = options.scope || "body";
  const root = document.querySelector(scope);
  if (!root) return { error: `scope ${scope} not found` };
  const all = [root, ...root.querySelectorAll("*")];
  const opacityZero = new Map();
  const hiddenByOpacity = (element) => {
    if (!element) return false;
    if (opacityZero.has(element)) return opacityZero.get(element);
    const result = Number.parseFloat(getComputedStyle(element).opacity) === 0 || hiddenByOpacity(element.parentElement);
    opacityZero.set(element, result);
    return result;
  };
  const visible = (element) => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0
      && !hiddenByOpacity(element) && !element.closest("[hidden],[inert],.visually-hidden");
  };
  const locator = (element) => {
    if (element.id) return `#${element.id}`;
    const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join("");
    const anchor = element.parentElement?.closest("[id]");
    return `${element.tagName.toLowerCase()}${classes}${anchor ? ` in #${anchor.id}` : ""}`;
  };
  const round = (value) => Math.round(value * 10) / 10;
  const shown = all.filter(visible);

  // 1. targets
  const targetNodes = shown.filter((element) => element.matches("button, a, input:not([type='hidden']), [role='button']"));
  const targetViolations = [];
  for (const element of targetNodes) {
    const box = element.getBoundingClientRect();
    if (box.width + 0.01 < 44 || box.height + 0.01 < 44) {
      targetViolations.push({ locator: locator(element), tag: element.tagName.toLowerCase(), width: round(box.width), height: round(box.height) });
    }
  }

  // 2. overflow
  const exceptions = options.exceptions || [];
  const overflow = [], ellipsis = [];
  const checked = scope === "body" ? [document.documentElement, ...shown] : shown;
  for (const element of checked) {
    if (element.clientWidth >= 1 && element.scrollWidth > element.clientWidth + 1) {
      const exception = exceptions.find((item) => element.matches(item.selector));
      if (!exception) overflow.push({ locator: locator(element), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth });
    }
    if (getComputedStyle(element).textOverflow.includes("ellipsis")) ellipsis.push({ locator: locator(element) });
  }

  // 3. orange budget
  const probeColor = (token) => {
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${token})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const rgbPattern = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/g;
  const channels = (value) => [...String(value || "").matchAll(rgbPattern)]
    .filter((match) => match[4] === undefined || Number.parseFloat(match[4]) > 0)
    .map((match) => `${match[1]},${match[2]},${match[3]}`);
  const accentColors = ["--accent", "--accent-deep"].map(probeColor);
  const accentSet = new Set(accentColors.flatMap((value) => channels(value)));
  const isAccent = (value) => channels(value).some((item) => accentSet.has(item));
  const allowlist = options.allowlist || [];
  const painted = [];
  const paintedProps = (style, { text, pseudo, svg }) => {
    const props = [];
    if (text && isAccent(style.color)) props.push("color");
    if (isAccent(style.backgroundColor)) props.push("background-color");
    if (style.backgroundImage !== "none" && isAccent(style.backgroundImage)) props.push("background-image");
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none" && isAccent(style[`border${side}Color`])) { props.push(`border-${side.toLowerCase()}-color`); break; }
    }
    if (Number.parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none" && isAccent(style.outlineColor)) props.push("outline-color");
    if (style.textDecorationLine !== "none" && isAccent(style.textDecorationColor)) props.push("text-decoration-color");
    if (style.boxShadow !== "none" && isAccent(style.boxShadow)) props.push("box-shadow");
    if (svg) {
      if (style.fill !== "none" && isAccent(style.fill)) props.push("fill");
      if (style.stroke !== "none" && isAccent(style.stroke)) props.push("stroke");
    }
    return props;
  };
  const record = (element, pseudo, props) => {
    if (!props.length) return;
    const entry = allowlist.find((item) => element.matches(item.selector) && (item.pseudo ?? null) === pseudo);
    painted.push({ locator: locator(element), pseudo, props, allowedBy: entry ? entry.category : null });
  };
  for (const element of shown) {
    const hasText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      || element.matches("input, textarea, select");
    record(element, null, paintedProps(getComputedStyle(element), { text: hasText, svg: element instanceof SVGElement }));
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      if (style.content === "none" || style.content === "normal" || style.display === "none") continue;
      record(element, pseudo, paintedProps(style, { text: style.content !== "\"\"", svg: false }));
    }
  }

  // 4. parity
  const parity = { outcomes: [], targets: [], orphans: [], vocabulary: [] };
  const i18n = window.RepForgeI18n;
  const program = window.__repforgeProgression;
  let durable = {};
  try { durable = JSON.parse(localStorage.getItem("repforge_v1") || "{}"); } catch { /* no durable state to read */ }
  const sessionRows = (exerciseId, sessionId) => {
    const rows = (durable.log || []).filter((row) => row.exerciseId === exerciseId);
    const session = sessionId || rows.map((row) => ({ session: row.session, order: `${row.date || ""}|${row.created || ""}` }))
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0)).at(-1)?.session;
    return rows.filter((row) => row.session === session);
  };
  for (const element of shown.filter((item) => item.hasAttribute("data-parity-outcome"))) {
    const exerciseId = element.getAttribute("data-parity-outcome");
    const entry = { locator: locator(element), exerciseId, text: element.textContent.replace(/\s+/g, " ").trim() };
    const slot = program?.programSlot?.(exerciseId);
    if (!slot) entry.error = `names unknown exercise ${exerciseId}`;
    else {
      const rows = sessionRows(exerciseId, element.getAttribute("data-parity-session"));
      if (!rows.length) entry.error = `has no logged session for ${exerciseId}`;
      else {
        // The status compareExerciseSession reaches, said in the session-outcome vocabulary the app shows
        // (CONTEXT.md "Session outcome": Melhorou, Manteve, Regressou, plus the two neutral labels).
        const wordKeys = {
          improved: "stats.outcome.improved", flat: "stats.outcome.maintained", regressed: "stats.outcome.declined",
          changed_load: "delta.changed_load.label", not_comparable: "delta.not_comparable.label", new: "stats.outcome_short.single_observation",
        };
        const compared = window.__repforgeCompareExercise(slot, rows);
        entry.expected = wordKeys[compared.status] && i18n ? i18n.t(wordKeys[compared.status]) : compared.label;
        // The same status in compareExerciseSession's own label is the same word (History's session page shows it;
        // PT says Manteve and Regressou in both vocabularies). A word for any other status still fails.
        entry.accepted = [...new Set([entry.expected, compared.label])];
      }
    }
    parity.outcomes.push(entry);
  }
  for (const element of shown.filter((item) => item.hasAttribute("data-parity-target"))) {
    const exerciseId = element.getAttribute("data-parity-target");
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const tokens = text.match(/\d+(?:[.,]\d+)?/g) || [];
    const entry = { locator: locator(element), exerciseId, text, tokens };
    // The load is the marked element's own load figure, never any number that happens to equal it (STD-1).
    // A figure the unit follows ("102,5 kg") is a load figure and the first one is the target, in the unit the
    // app shows. Text with no unit-bearing figure is a bare load, which is only one figure.
    const unitFigures = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?)(?![\p{L}\d])/giu)];
    entry.unit = durable.settings?.unit === "lb" ? "lb" : "kg";
    entry.loadToken = null;
    if (unitFigures.length) {
      entry.loadToken = unitFigures[0][1];
      entry.unitMismatch = unitFigures[0][2].toLowerCase().replace(/s$/, "") !== entry.unit;
    } else if (tokens.length === 1) entry.loadToken = tokens[0];
    const slot = program?.programSlot?.(exerciseId);
    if (!slot) entry.error = `names unknown exercise ${exerciseId}`;
    else {
      const load = program.recommendation(slot).load;
      entry.expectedLoad = Number.isFinite(load) ? load : null;
      if (entry.expectedLoad !== null) {
        // The app's own display-to-kg parser, with the tolerance of the figure's last shown decimal.
        const token = entry.loadToken;
        entry.matched = token !== null && !entry.unitMismatch && (() => {
          const decimals = (token.split(/[.,]/)[1] || "").length;
          const base = window.__repforgeParseLoad(token);
          const high = window.__repforgeParseLoad(String(+(Number.parseFloat(token.replace(",", ".")) + 0.5 * 10 ** -decimals).toFixed(decimals + 1)));
          return base.kind === "valid" && Math.abs(base.kg - load) <= Math.abs(high.kg - base.kg) + 1e-9;
        })();
      }
    }
    parity.targets.push(entry);
  }
  parity.vocabulary = i18n ? [
    ...["improved", "flat", "regressed", "changed_load", "new", "not_comparable"].map((name) => i18n.t(`delta.${name}.label`)),
    ...["improved", "maintained", "declined"].map((name) => i18n.t(`stats.outcome.${name}`)),
  ] : [];
  for (const element of shown) {
    if (element.hasAttribute("data-parity-outcome")) continue;
    const own = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").replace(/\s+/g, " ").trim();
    if (own && parity.vocabulary.includes(own)) parity.orphans.push({ locator: locator(element), text: own });
  }

  // 5. strings
  const textVisible = (element) => visible(element) && !element.closest("[aria-hidden='true']");
  // A sentence that sets one figure or name in a second face ("Hold <b>102,5</b> kg") is one string.
  // It is read whole when every child element is inline text, so the catalog pattern can match it.
  const inlineTags = new Set(["B", "STRONG", "I", "EM", "SPAN", "SMALL", "U", "MARK", "SUB", "SUP", "ABBR", "TIME"]);
  const sentence = (element) => {
    const children = [...element.children];
    if (!children.length || !children.every((child) => inlineTags.has(child.tagName) && !child.matches("button, a, input, [role='button']"))) return null;
    let out = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) out += node.textContent || "";
      else if (node.nodeType === Node.ELEMENT_NODE && !node.matches("[aria-hidden='true'], .visually-hidden") && visible(node)) out += node.textContent || "";
    }
    return out.replace(/\s+/g, " ").trim() || null;
  };
  const text = [];
  for (const element of all) {
    if (!textVisible(element)) continue;
    const hasOwn = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim());
    // A sentence read whole: inline-tag children (the Why sheet's bold figures), or children that render inline
    // (the summary's outcome and record lines).
    const inlineKids = element.children.length > 0 && [...element.children].every((child) => getComputedStyle(child).display.startsWith("inline"));
    const whole = hasOwn ? (sentence(element) || (inlineKids ? element.textContent.replace(/\s+/g, " ").trim() : null)) : null;
    const own = whole || [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || "").join("").trim();
    if (own) text.push({ locator: locator(element), text: own });
    for (const attribute of ["aria-label", "title", "alt"]) {
      if (element.hasAttribute(attribute) && element.getAttribute(attribute).trim()) text.push({ locator: locator(element), text: element.getAttribute(attribute) });
    }
    if (element.matches("input, textarea")) {
      const displayed = element.value || element.getAttribute("placeholder") || "";
      if (displayed) text.push({ locator: locator(element), text: displayed });
    }
    if (element.matches("select")) {
      const displayed = [...element.selectedOptions].map((option) => option.textContent || "").join(" ").trim();
      if (displayed) text.push({ locator: locator(element), text: displayed });
    }
  }
  const requestedI18nKeys = shown.filter((element) => element.matches("[data-i18n], [data-i18n-aria], [data-i18n-placeholder], [data-i18n-title]"))
    .flatMap((element) => ["data-i18n", "data-i18n-aria", "data-i18n-placeholder", "data-i18n-title"]
      .map((attribute) => element.getAttribute(attribute)).filter(Boolean).map((key) => ({ locator: locator(element), key })));
  if (scope === "body") {
    for (const key of window.__repforgeI18nMissingRequests?.consume?.() || []) requestedI18nKeys.push({ locator: "RepForgeI18n.t()", key });
  }
  const timerLabels = [];
  for (const selector of options.timerScopes || []) {
    for (const element of shown.filter((item) => item.matches(selector) || item.closest(selector))) {
      const own = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || "").join("").trim();
      for (const label of [own, element.getAttribute("aria-label"), element.getAttribute("title")].filter(Boolean)) timerLabels.push({ locator: locator(element), label });
    }
  }
  const leaves = (value, into, depth = 0) => {
    if (typeof value === "string") into.add(value.trim());
    else if (depth < 6 && value && typeof value === "object") for (const item of Object.values(value)) leaves(item, into, depth + 1);
  };
  const data = new Set();
  for (const part of ["program", "programMeta", "log", "programHistory", "customExercises"]) leaves(durable[part], data);
  leaves(window.__repforgeExerciseLibrary, data);
  const language = (i18n?.getLang?.() === "pt" ? "pt-BR" : "en");
  const names = [];
  for (const width of ["long", "short", "narrow"]) {
    const weekday = new Intl.DateTimeFormat(language, { weekday: width, timeZone: "UTC" });
    const month = new Intl.DateTimeFormat(language, { month: width, timeZone: "UTC" });
    for (let index = 0; index < 12; index++) {
      if (index < 7) names.push(weekday.format(new Date(Date.UTC(2024, 0, 1 + index))));
      names.push(month.format(new Date(Date.UTC(2024, index, 1))));
    }
  }
  return {
    scope, viewport: { width: window.innerWidth },
    accent: { colors: accentColors, painted },
    targets: { count: targetNodes.length, violations: targetViolations },
    overflow, ellipsis, parity, text, requestedI18nKeys, timerLabels,
    data: { strings: [...data].filter((value) => value.length >= 2 && /\p{L}/u.test(value)), dateWords: names },
  };
}

export async function gatherEvidence(page, options = {}) {
  return page.evaluate(collectGateEvidence, {
    allowlist: ORANGE_ALLOWLIST, exceptions: OVERFLOW_EXCEPTIONS, timerScopes: TIMER_SCOPES, ...options,
  });
}

const prefix = (name, message) => `${name}: ${message}`;
const excerpt = (value) => String(value).replace(/\s+/g, " ").slice(0, 160);

export function checkTargets(evidence) {
  if (evidence.error) return [prefix("targets", evidence.error)];
  return evidence.targets.violations.map((item) => prefix("targets", `${item.locator} (${item.tag}) is ${item.width} x ${item.height}, under 44 x 44`));
}

export function checkOverflow(evidence) {
  if (evidence.error) return [prefix("overflow", evidence.error)];
  return [
    ...evidence.overflow.map((item) => prefix("overflow", `${item.locator} has ${item.scrollWidth}px of content in a ${item.clientWidth}px box`)),
    ...evidence.ellipsis.map((item) => prefix("overflow", `${item.locator} sets text-overflow: ellipsis (D surfaces wrap, never truncate)`)),
  ];
}

export function checkOrange(evidence) {
  if (evidence.error) return [prefix("orange", evidence.error)];
  return evidence.accent.painted.filter((item) => !item.allowedBy)
    .map((item) => prefix("orange", `${item.locator}${item.pseudo || ""} is painted with the accent (${item.props.join(", ")}) and is not on the orange-budget list`));
}

export function checkParity(evidence) {
  if (evidence.error) return [prefix("parity", evidence.error)];
  const failures = [];
  for (const item of evidence.parity.outcomes) {
    if (item.error) failures.push(prefix("parity", `${item.locator} ${item.error}`));
    else if (!(item.accepted || [item.expected]).includes(item.text)) failures.push(prefix("parity", `outcome word at ${item.locator} reads "${item.text}" but compareExerciseSession(${item.exerciseId}) says "${item.expected}"`));
  }
  for (const item of evidence.parity.targets) {
    if (item.error) failures.push(prefix("parity", `${item.locator} ${item.error}`));
    else if (item.expectedLoad !== null && !item.matched) failures.push(prefix("parity", `target at ${item.locator} ${item.loadToken === null ? `has no single load figure in [${item.tokens.join(", ")}]` : item.unitMismatch ? `shows its load in the wrong unit (the app shows ${item.unit})` : `shows the load ${item.loadToken}`} but recommendation(${item.exerciseId}).load is ${item.expectedLoad} kg`));
  }
  for (const item of evidence.parity.orphans) {
    failures.push(prefix("parity", `outcome word "${item.text}" at ${item.locator} has no ${PARITY_ATTRIBUTES.outcome} marker, so it cannot be checked against compareExerciseSession`));
  }
  return failures;
}

// Patterns duplicated from test/i18n.mjs (which cannot be imported); see GAPS.
const PUNCTUATION = /[—“”‘’]/u;
const BANNED_WORDS = [
  { word: "Regrediu", pattern: /\bRegrediu\b/iu, langs: ["pt", "en"], source: "D spec section 6" },
  { word: "stats|log|performance|delta|split|offline|aparelho", pattern: /\b(?:stats|logs?|performance|deltas?|split|offline|aparelhos?)\b/iu, langs: ["pt"], source: "brand guide, test/i18n.mjs" },
  { word: "filler vocabulary", pattern: /\b(?:additionally|crucial|delve|enduring|enhance|fostering|garner|interplay|intricate|landscape|pivotal|showcase|tapestry|testament|underscore|vibrant|utilize|leverage|facilitate|serves as|stands as|boasts)\b/iu, langs: ["en"], source: "test/i18n.mjs" },
];
const compiled = new WeakMap();
function catalogMatchers(dictionary) {
  if (compiled.has(dictionary)) return compiled.get(dictionary);
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [];
  for (const value of Object.values(dictionary)) {
    for (const segment of String(value).split(/<[^>]*>/)) {
      const normal = segment.replace(/\s+/g, " ").trim();
      if (!/\p{L}/u.test(normal.replace(/\{\w+\}/g, ""))) continue;
      patterns.push(new RegExp(`^${escape(normal).replace(/\\\{\w+\\\}/g, ".+?")}$`, "iu"));
    }
  }
  compiled.set(dictionary, patterns);
  return patterns;
}

export function checkStrings(evidence, catalog) {
  if (evidence.error) return [prefix("strings", evidence.error)];
  const failures = [];
  const matchers = catalogMatchers(catalog.dictionary);
  // 1. Raw keys, unresolved tokens and missing requested keys: the catalog contract's own rules.
  for (const failure of validateCatalogEvidence({
    document: { clientWidth: 1, scrollWidth: 1 }, overflow: [], scrollers: [], nonOverlap: [], copyAllowances: [],
    text: evidence.text, requestedI18nKeys: evidence.requestedI18nKeys,
  }, {}, { knownKeyNamespaces: catalog.namespaces, knownKeys: catalog.keys })) failures.push(prefix("strings", failure));

  const dataStrings = [...new Set(evidence.data.strings)].sort((a, b) => b.length - a.length);
  const dataPattern = dataStrings.length ? new RegExp(dataStrings.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "giu") : null;
  const dateWords = new Set(evidence.data.dateWords.flatMap((word) => word.toLowerCase().replace(/\./g, "").split(/\s+/)));
  // "k" is the thousands suffix of a figure ("14,3k kg moved"), not a word.
  const unitWords = new Set(["kg", "lb", "k"]);
  const residueOk = (fragment) => {
    const words = fragment.replace(/[\d.,:%+×x–-]+/gu, " ").split(/\s+/).map((word) => word.replace(/[.]/g, "").toLowerCase()).filter((word) => /\p{L}/u.test(word));
    return words.every((word) => unitWords.has(word) || dateWords.has(word));
  };
  // A catalog phrase followed by figures only ("Top load 102.5 kg") is that phrase and data, not a new string.
  // The trailing part may hold digits, separators and unit tokens, never a word.
  const figuresOnly = (rest) => rest.split(/\s+/).filter(Boolean)
    .every((token) => /^[\d.,:%+×x–−-]*\d[\d.,:%+×x–−-]*$/u.test(token) || /^(?:kg|lb)$/i.test(token) || /^[×x–−+-]$/u.test(token));
  const plainPhrases = [...new Set(Object.values(catalog.dictionary).map((value) => String(value).replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 3 && /\p{L}/u.test(value) && !/[{}<>]/.test(value)))].sort((a, b) => b.length - a.length);
  const afterLeadingPhrase = (fragment) => {
    const lower = fragment.toLowerCase();
    const phrase = plainPhrases.find((candidate) => lower.startsWith(`${candidate.toLowerCase()} `));
    return phrase ? fragment.slice(phrase.length).trim() : null;
  };
  const catalogOrData = (value) => {
    const whole = value.replace(/\s+/g, " ").trim();
    if (!/\p{L}/u.test(whole) || matchers.some((pattern) => pattern.test(whole))) return true;
    const rest = dataPattern ? whole.replace(dataPattern, " ") : whole;
    // A slash stays inside a fragment first ("Costas médias/superiores" is one catalog word);
    // only a fragment that is not whole-string a catalog value is split on it.
    // Sentences the app composes (a catalog sentence, a space, the next catalog sentence) are checked one by one.
    const wholeKnown = (fragment) => matchers.some((pattern) => pattern.test(fragment)) || residueOk(fragment);
    const known = (fragment) => wholeKnown(fragment)
      || fragment.split(/(?<=[.!?])\s+/u).filter((sentence) => /\p{L}/u.test(sentence)).every(wholeKnown);
    return rest.split(/\s*[·•|,;:()[\]+×–]\s*|\s+-\s+/u).map((fragment) => fragment.replace(/\s+/g, " ").trim())
      .filter((fragment) => /\p{L}/u.test(fragment))
      .every((fragment) => known(fragment) || fragment.split(/\s*\/\s*/u).filter((part) => /\p{L}/u.test(part)).every(known)
        || (afterLeadingPhrase(fragment) !== null && figuresOnly(afterLeadingPhrase(fragment))));
  };
  const seen = new Set();
  for (const item of evidence.text) {
    const whole = item.text.replace(/\s+/g, " ").trim();
    const key = `${item.locator}|${whole}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const residue = dataPattern ? whole.replace(dataPattern, " ") : whole;
    if (PUNCTUATION.test(residue)) failures.push(prefix("strings", `banned em dash or curly quote at ${item.locator}: "${excerpt(whole)}"`));
    for (const banned of BANNED_WORDS) {
      if (banned.langs.includes(catalog.lang) && banned.pattern.test(residue)) failures.push(prefix("strings", `banned word ${banned.word} (${banned.source}) at ${item.locator}: "${excerpt(whole)}"`));
    }
    if (!catalogOrData(whole)) failures.push(prefix("strings", `not a catalog string at ${item.locator}: "${excerpt(whole)}"`));
  }
  for (const item of evidence.timerLabels) {
    if (/^hold\b/i.test(item.label.trim()) && !/\d/.test(item.label)) failures.push(prefix("strings", `banned "Hold" as a timer label at ${item.locator}: "${excerpt(item.label)}"`));
  }
  return failures;
}

export const CHECKS = Object.freeze({ targets: checkTargets, overflow: checkOverflow, orange: checkOrange, parity: checkParity, strings: checkStrings });

/**
 * Validate the list, then render and check states.
 * `renderPending` renders named pending states without enforcing them;
 * `diagnose` also runs the checks on those and reports (never fails) what they find.
 */
export async function runGate({
  states = DIRECTION_D_STATES, locales = ["pt", "en"], theme = "light", renderPending = [], diagnose = false,
  browser = null, manifest = loadManifest(), onProgress = () => {},
} = {}) {
  const failures = [
    ...validateStateList(states, manifest),
    ...validateGateConfig({ allowlist: ORANGE_ALLOWLIST, exceptions: OVERFLOW_EXCEPTIONS }),
  ];
  const enforced = states.filter((item) => item.status === "implemented").map((item) => item.key);
  const pending = states.filter((item) => item.status === "pending").map((item) => item.key);
  const result = { ok: false, failures, enforced, pending, rendered: [], diagnostics: [], gaps: GAPS };
  const rendering = [...new Set([...enforced, ...renderPending])].filter((key) => manifest.screens.some((screen) => `${screen.flow}/${screen.id}` === key));
  if (!rendering.length || failures.length) { result.ok = failures.length === 0; return result; }

  const gate = gateManifest(manifest);
  let preview = null, own = null;
  if (!browser) {
    preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
    setCaptureBase(preview.env.REPFORGE_URL);
    own = browser = await launchChromium();
  }
  try {
    for (const key of rendering) {
      for (const locale of locales) {
        const label = `${key} [${locale}]`;
        const enforce = enforced.includes(key);
        let context;
        try {
          if (!APP_SCENARIOS[key]) throw new Error("missing production catalog scenario");
          const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-360", theme, locale, text: "normal", motion: "normal" };
          const opened = await openPage(browser, gate, capture, appState(key, gate.locales[locale].lang), { userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key] });
          context = opened.context;
          await dismissChrome(opened.page);
          await APP_SCENARIOS[key](opened.page);
          await settle(opened.page);
          const evidence = await gatherEvidence(opened.page, STATE_SCOPES[key] ? { scope: STATE_SCOPES[key] } : {});
          const catalog = loadCatalog(locale);
          const found = [...new Set(Object.values(CHECKS).flatMap((check) => check(evidence, catalog)))].map((message) => `${label} ${message}`);
          result.rendered.push({ key, locale, enforced: enforce, findings: found.length });
          if (enforce) failures.push(...found);
          else if (diagnose) result.diagnostics.push(...found);
        } catch (error) {
          if (enforce || diagnose) failures.push(`${label} could not be rendered: ${error.stack || error.message}`);
          else result.diagnostics.push(`${label} could not be rendered: ${error.message}`);
        } finally {
          await context?.close();
        }
        onProgress(label);
      }
    }
  } finally {
    await own?.close();
    preview?.cleanup();
  }
  result.ok = failures.length === 0;
  return result;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  const stateKey = option("--state"), locale = option("--locale"), theme = option("--theme") || "light";
  const enforceExtra = args.includes("--enforce");
  const manifest = loadManifest();
  let states = DIRECTION_D_STATES;
  if (stateKey && enforceExtra) states = states.map((item) => (item.key === stateKey ? { ...item, status: "implemented" } : item));
  const result = await runGate({
    states, theme, manifest, locales: locale ? [locale] : ["pt", "en"], renderPending: stateKey ? [stateKey] : [],
    onProgress: (label) => console.log(`  checked ${label}`),
  });
  console.log(`Direction D gate: ${states.length} states listed, ${result.enforced.length} implemented (enforced), ${result.pending.length} pending (listed, not enforced).`);
  for (const item of result.rendered) console.log(`  ${item.key} [${item.locale}] ${item.enforced ? "enforced" : "pending, rendered only"}: ${item.findings} finding(s)`);
  if (args.includes("--verbose")) {
    for (const finding of result.diagnostics) console.log(`  note: ${finding}`);
    for (const gap of GAPS) console.log(`  gap: ${gap}`);
  } else console.log(`  ${GAPS.length} explicit rule gaps recorded in GAPS (run with --verbose to print them).`);
  for (const failure of result.failures.slice(0, 40)) console.error(`FAIL: ${failure}`);
  if (result.failures.length > 40) console.error(`... ${result.failures.length - 40} more failures`);
  if (!result.ok) process.exitCode = 1;
}
