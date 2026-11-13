/**
 * 055-P6 Verification Suite: Focus Geometry, Timer Stability, and Gesture Lifetime.
 *
 * Requirements:
 * 1. Geometry stability: bounding boxes for title, timer chip, and previous-session band
 *    are stable across 320/390/430 viewports, EN/PT, 200% font scaling, and PT+200%.
 * 2. Deliberate failure contract: title must NOT shift or wrap/clip when the timer
 *    transitions between idle and running at PT+200%.
 * 3. Previous-session band minimum: defined compact ledger band that does not dominate.
 * 3. The shelf's action stays whole at large text (R7 V-02): on every Focus state of the screen catalog, at 320, 360 and
 *    390 in both languages with double-size text, the action is inside the viewport above the bottom safe area and
 *    is what a tap lands on, the load does not wrap, the card does not overflow, no two lines of the shelf overprint,
 *    and the context region (never the shelf) is what gives up height.
 * 3b. The smallest phone at the usual size (R7 V-05): the day title shows in full, the context region opens at its top
 *    with the exercise's name in view, a running rest keeps a readable block, and the shelf keeps its action.
 * 4. Explicit gesture controller lifetime:
 *    - Boot mounts one gesture owner returning a disposal handle { dispose }.
 *    - Mounting twice is idempotent (does not duplicate listeners/navigation).
 *    - Disposal safely removes listeners, disconnects observers, cancels running work.
 *    - Disposal during active drag/swipe is safe.
 *    - Pointer cancellation, Escape, and reduced-motion remain correct.
 *    - Missing Motion runtime leaves fallback functional.
 */

import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { CATALOG_PHONES, SAFE_AREA, inPool, openCatalogState } from "./fixtures/catalog-state.mjs";

const BASE_URL = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";

// --only large,smallest selects sections for independent CI commands. The environment selector remains available locally; no selector runs all assertions.
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--only" || !args[1]))
  throw new Error("Usage: node test/focus-geometry.mjs [--only section[,section]]");
const only = (args[1] || process.env.FOCUS_GEOMETRY_ONLY || "").split(",").filter(Boolean);
const sections = ["stability", "large", "smallest", "standing", "context", "effort", "test-set", "guess", "dismissal", "gestures"];
if (only.some(section => !sections.includes(section))) throw new Error(`Unknown Focus geometry section: ${only.join(",")}`);
const wants = (section) => !only.length || only.includes(section);

function assert(condition, message, detail = "") {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}${detail ? ` — detail: ${detail}` : ""}`);
  }
}

const FOCUS_STATES = ["workout/focus", "workout/focus-glossary", "workout/exercise-note", "workout/why-this-weight",
  "workout/rest-running", "workout/rest-done", "workout/correction", "workout/logged-sets", "workout/stale-draft", "workout/persist-retry"];

/** What the live Focus card looks like in this frame; every number is measured in the page. */
function measureFocusCard(safeBottom) {
  const q = (selector, root = document) => root.querySelector(selector);
  const art = q("#workout .exercise--focus.is-current");
  if (!art) return { error: "no live Focus card" };
  const cta = q("[data-save]", art);
  if (!cta) return { error: "the shelf has no action" };
  const rect = cta.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const values = [...art.querySelectorAll(".shelf__val")].map((value) => {
    const lineHeight = parseFloat(getComputedStyle(value).lineHeight);
    return { text: value.textContent.trim(), height: value.scrollHeight, lineHeight, wraps: value.scrollHeight > lineHeight * 1.5, spills: value.scrollWidth > value.clientWidth + 1 };
  });
  const shelf = q(".focus-shelf", art);
  const boxes = [];
  const walker = document.createTreeWalker(shelf, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    let hidden = false;
    for (let el = node.parentElement; el && el !== shelf.parentElement; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) { hidden = true; break; }
    }
    if (hidden) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) if (box.width > 1 && box.height > 1) boxes.push({ text: node.textContent.trim().slice(0, 16), left: box.left, right: box.right, top: box.top, bottom: box.bottom });
  }
  const overprinted = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    // Tight leading lets neighbouring lines' boxes touch; overprint is one line sitting over another.
    const across = Math.min(a.right, b.right) - Math.max(a.left, b.left), down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (across > 1 && down > 0.35 * Math.min(a.bottom - a.top, b.bottom - b.top)) overprinted.push(`${a.text} / ${b.text}`);
  }
  const context = q(".fcard__context", art);
  const banner = q("#draftRecovery");
  const bannerRect = banner && !banner.classList.contains("hidden") ? banner.getBoundingClientRect() : null;
  const shelfRect = shelf.getBoundingClientRect();
  const openRect = q(".ledgerline--open", art)?.getBoundingClientRect();
  const title = q("#woDayTitle"), name = q(".focus-ex__meta", art), tab = q("#restTab");
  const nameRect = name?.getBoundingClientRect(), tabRect = tab?.getBoundingClientRect();
  return {
    height: innerHeight,
    openRow: openRect && { top: openRect.top, bottom: openRect.bottom, shelfTop: shelfRect.top },
    // A state that opens a sheet or the glossary is drawn with that layer over the card, and what lies over the action
    // there is the layer's; every other state must put the tap on the action itself.
    action: { top: rect.top, bottom: rect.bottom, inside: rect.top >= 0 && rect.bottom <= innerHeight - safeBottom + 0.5,
      tapped: !!hit && (hit === cta || cta.contains(hit) || !!hit.closest(".sheet,.sheet-scrim,#glossary")) },
    values, overprinted,
    card: { scroll: art.scrollHeight, client: art.clientHeight },
    contextScrolls: !!context && ["auto", "scroll"].includes(getComputedStyle(context).overflowY),
    banner: bannerRect && { top: bannerRect.top, bottom: bannerRect.bottom, aboveShelf: bannerRect.bottom <= shelfRect.top + 1 },
    // Layout D: the title is the exercise's name, two lines at most; the heading's accessible name keeps all of it.
    title: (() => {
      const nameEl = title.querySelector(".wo-head__name") || title, s = getComputedStyle(nameEl);
      const lines = Math.round((nameEl.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)) / parseFloat(s.lineHeight));
      return { lines, label: title.getAttribute("aria-label"), text: nameEl.textContent.trim() };
    })(),
    window: context && { top: context.getBoundingClientRect().top, bottom: context.getBoundingClientRect().bottom, scrollTop: context.scrollTop },
    name: nameRect && { top: nameRect.top, bottom: nameRect.bottom },
    tab: tabRect && { top: tabRect.top, bottom: tabRect.bottom, left: tabRect.left, right: tabRect.right, height: tabRect.height },
  };
}

function focusCardProblems(m) {
  if (m.error) return [m.error];
  const problems = [];
  if (!m.action.inside) problems.push(`the action is not above the safe area (top ${Math.round(m.action.top)}, bottom ${Math.round(m.action.bottom)} of ${m.height}, safe ${SAFE_AREA.bottom})`);
  if (!m.action.tapped) problems.push("a tap at the centre of the action does not land on it");
  const wrapped = m.values.filter((value) => value.wraps || value.spills);
  if (wrapped.length) problems.push(`shelf values wrap or spill: ${wrapped.map((value) => `${value.text} (${Math.round(value.height)}px over a ${Math.round(value.lineHeight)}px line)`).join(", ")}`);
  if (m.card.scroll > m.card.client + 1) problems.push(`the card overflows itself (${m.card.scroll} > ${m.card.client})`);
  if (m.overprinted.length) problems.push(`shelf lines overprint: ${m.overprinted.join("; ")}`);
  if (!m.contextScrolls) problems.push("the context region is not the scroller");
  if (m.banner && !m.banner.aboveShelf) problems.push(`the banner (bottom ${Math.round(m.banner.bottom)}) is not above the shelf`);
  return problems;
}

async function checkFocusStatesAtLargeText(browser) {
  console.log("\nFocus states at double-size text: 320/360/390 x EN/PT, every catalog state");
  const cases = [];
  for (const key of FOCUS_STATES) for (const width of Object.keys(CATALOG_PHONES)) for (const lang of ["en", "pt"]) cases.push({ key, width: +width, lang });
  const failures = [];
  await inPool(cases, 3, async ({ key, width, lang }) => {
    const label = `${key} ${width}px ${lang} 200%`;
    let opened;
    try {
      opened = await openCatalogState(browser, key, width, lang, "text200");
      const problems = focusCardProblems(await opened.page.evaluate(measureFocusCard, SAFE_AREA.bottom));
      if (problems.length) failures.push(`${label}: ${problems.join(" | ")}`);
    } catch (error) {
      failures.push(`${label}: the state did not reach its drawing: ${String(error.message).split("\n")[0]}`);
    } finally {
      await opened?.context.close();
    }
  });
  failures.sort();
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  assert(!failures.length, `${failures.length} of ${cases.length} large-text Focus frames lose the shelf's action or its values`, failures.slice(0, 3).join(" || "));
  console.log(`  ${cases.length} frames keep the shelf whole`);
}

/** The part of a box that shows inside the context region's window. */

/**
 * R7 V-05, as amended by layout D: Focus at 320x568 with the usual text. The title is the exercise's name in at most
 * two lines, and the heading is named by all of it; the context
 * region opens at its top with the exercise's name in view, a running or finished rest keeps a readable part of its
 * block in the window, and a banner or guide never takes the shelf's room.
 */
async function checkFocusAtSmallestPhone(browser) {
  console.log("\nFocus on the smallest phone at the usual size: 320x568, EN/PT");
  const cases = [];
  for (const key of ["workout/focus", "workout/rest-running", "workout/rest-done", "workout/stale-draft", "workout/persist-retry"]) for (const lang of ["en", "pt"]) cases.push({ key, lang });
  const failures = [];
  await inPool(cases, 3, async ({ key, lang }) => {
    const label = `${key} 320px ${lang} 100%`;
    let opened;
    try {
      opened = await openCatalogState(browser, key, 320, lang, "normal");
      const m = await opened.page.evaluate(measureFocusCard, SAFE_AREA.bottom);
      const problems = focusCardProblems(m);
      if (!m.error) {
        if (m.title.lines > 2 || !m.title.label || !m.title.label.startsWith(m.title.text.replace(/…$/, ""))) problems.push(`the header's name takes ${m.title.lines} lines or the heading loses it (${JSON.stringify(m.title)})`);
        if (key === "workout/focus") {
          if (m.window.scrollTop !== 0) problems.push(`the context region opens scrolled ${Math.round(m.window.scrollTop)}px`);
          if (!m.name || m.name.top < m.window.top - 1 || m.name.bottom > m.window.bottom + 1) problems.push("the exercise's prescription line is not whole in the context window on first paint");
        }
        // The rest timer redesign: the rest is the tab over the shelf, whole on screen and a 44px target.
        if (/^workout\/rest-(running|done)$/.test(key) && (!m.tab || m.tab.top < 0 || m.tab.bottom > m.height + 0.5 || m.tab.left < -0.5 || m.tab.right > 320.5 || m.tab.height < 44 - 0.01)) problems.push(`the rest tab is not whole on screen with a 44px target (${JSON.stringify(m.tab)})`);
      }
      if (problems.length) failures.push(`${label}: ${problems.join(" | ")}`);
    } catch (error) {
      failures.push(`${label}: the state did not reach its drawing: ${String(error.message).split("\n")[0]}`);
    } finally {
      await opened?.context.close();
    }
  });
  failures.sort();
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  assert(!failures.length, `${failures.length} of ${cases.length} Focus frames on the smallest phone hide the title, the name or the rest block`, failures.slice(0, 3).join(" || "));
  console.log(`  ${cases.length} frames show the title, the name and the rest block`);
}

async function checkStandingLedger(browser) {
  console.log("\nStanding and the current row: 320x568 EN/PT, 390px EN/PT at 200%");
  const failures = [];
  for (const width of [320, 390]) for (const lang of ["en", "pt"]) {
    const text = width === 320 ? "normal" : "text200";
    // Match the registered 320px frame. The established inset checks above remain unchanged; 390px keeps them too.
    const opened = await openCatalogState(browser, "workout/focus", width, lang, text,
      width === 320 ? { safe: { top: 0, bottom: 0 } } : {});
    try {
      const m = await opened.page.evaluate(measureFocusCard, width === 320 ? 0 : SAFE_AREA.bottom);
      const row = m.openRow;
      if (!row || row.bottom > Math.min(row.shelfTop, m.window.bottom) + 1 || row.top < m.window.top - 1)
        failures.push(`${width}px ${lang} ${text}: current row ${JSON.stringify(row)}, window ${JSON.stringify(m.window)}`);
      const standing = await opened.page.locator(".exercise.is-current .fx-cue__standing").boundingBox();
      if (!standing || standing.y < m.window.top - 1 || standing.y + standing.height > m.window.bottom + 1)
        failures.push(`${width}px ${lang} ${text}: standing is not whole in the context window`);
      if (width === 390 && lang === "pt") {
        const available = Math.min(row.shelfTop, m.window.bottom) - m.window.top;
        assert(standing && row.bottom - standing.y <= available,
          "390px PT 200% regression fixture fits standing and the current row together");
        assert(standing.y >= m.window.top - 1 && standing.y + standing.height <= m.window.bottom + 1,
          "390px PT 200% keeps the fitting standing line visible with the current row",
          JSON.stringify({ row, window: m.window, standing }));
      }
      if (width === 320 && m.window.scrollTop !== 0)
        failures.push(`${width}px ${lang}: initial context scrolled ${m.window.scrollTop}px`);
      if (process.env.REPFORGE_ARTIFACT_DIR) await opened.page.screenshot({
        path: `${process.env.REPFORGE_ARTIFACT_DIR}/standing-${width}-${lang}.png`,
      });
      console.log(`  ${width}px ${lang} ${text}: ${JSON.stringify({ row, window: m.window, standing })}`);
    } finally {
      await opened.context.close();
    }
  }
  assert(!failures.length, "standing leaves the whole current row above the shelf", failures.join(" | "));
}


async function checkOpeningStandingLedger(browser) {
  const opened = await openCatalogState(browser, "workout/focus-ramp-floor", 320, "en", "normal",
    { safe: { top: 0, bottom: 0 } });
  try {
    const m = await opened.page.evaluate(measureFocusCard, 0);
    const standing = await opened.page.locator(".exercise.is-current .fx-cue__standing").boundingBox();
    const row = m.openRow, bottom = Math.min(row.shelfTop, m.window.bottom);
    assert(standing && row.bottom - standing.y <= bottom - m.window.top,
      "320px opening-ramp fixture fits standing and the current row together");
    assert(standing.y >= m.window.top - 1 && standing.y + standing.height <= bottom + 1 &&
      row.top >= m.window.top - 1 && row.bottom <= bottom + 1,
      "the first opening-ramp row stays visible with its fitting standing line",
      JSON.stringify({ row, window: m.window, standing }));
  } finally {
    await opened.context.close();
  }
}

async function checkContextText(browser) {
  const failures = [];
  const cases = ["workout/max-set-guess", "workout/max-set-prompt", "workout/why-in-session"]
    .map(key => ({ key, width: 320, lang: "en", text: "normal", requireRow: true }));
  for (const key of ["workout/focus-ramp", "workout/focus-ramp-ratio", "workout/focus-ramp-substitution", "workout/focus-ramp-floor"])
    for (const lang of ["en", "pt"]) for (const [width, text] of [[390, "text200"], [320, "text200"], [320, "normal"]])
      cases.push({ key, width, lang, text, requireRow: text === "text200" });
  for (const { key, width, lang, text, requireRow } of cases) {
    const label = `${key} ${width}px ${lang} ${text}`;
    // Match the catalog frames' insets; the standing section separately covers device safe areas.
    const opened = await openCatalogState(browser, key, width, lang, text, { safe: { top: 0, bottom: 0 } });
    try {
      const measured = await opened.page.evaluate(() => {
        const context = document.querySelector(".exercise.is-current .fcard__context");
        const window = context.getBoundingClientRect(), cut = [];
        const walker = document.createTreeWalker(context, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent.trim() || node.parentElement.closest(".visually-hidden")) continue;
          let hidden = false;
          for (let el = node.parentElement; el && el !== context; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) { hidden = true; break; }
          }
          if (hidden) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 1 && rect.height > 1 && rect.top < window.top - 0.5 && rect.bottom > window.top + 0.5)
              cut.push({ text: node.textContent.trim(), top: rect.top, bottom: rect.bottom });
          }
        }
        const row = context.querySelector(".ledgerline--open").getBoundingClientRect();
        const tab = document.querySelector(".exercise.is-current .resttab");
        const bottom = Math.min(window.bottom, tab ? tab.getBoundingClientRect().top : Infinity);
        return { cut, top: window.top, scrollTop: context.scrollTop, row: { top: row.top, bottom: row.bottom }, bottom };
      });
      console.log(`  ${label}: ${JSON.stringify(measured)}`);
      if (measured.cut.length) failures.push(`${label}: ${JSON.stringify(measured)}`);
      if (requireRow) assert(measured.row.top >= measured.top - 1 && measured.row.bottom <= measured.bottom + 1,
        `${label}: current row remains above the shelf`, JSON.stringify(measured));
      if (process.env.REPFORGE_ARTIFACT_DIR) await opened.page.screenshot({
        path: `${process.env.REPFORGE_ARTIFACT_DIR}/${key.split("/")[1]}-${width}-${lang}-${text}-context.png`,
      });
    } finally {
      await opened.context.close();
    }
  }
  assert(!failures.length, "Focus context text is never clipped below the progress bars", failures.join(" | "));
}

async function checkTestSetPrompt(browser) {
  const failures = [];
  const cases = [];
  for (const key of ["workout/max-set-prompt", "workout/max-set-recheck"])
    for (const width of [320, 390, 430]) for (const lang of ["en", "pt"]) for (const text of ["normal", "text200"])
      cases.push({ key, width, lang, text });
  await inPool(cases, 3, async ({ key, width, lang, text }) => {
      const opened = await openCatalogState(browser, key, width, lang, text, { height: width === 430 ? 932 : CATALOG_PHONES[width], safe: { top: 0, bottom: 0 } });
      const label = `${key} ${width}px ${lang} ${text}`;
      try {
        for (const problem of focusCardProblems(await opened.page.evaluate(measureFocusCard, 0))) failures.push(`${label}: ${problem}`);
        const measured = await opened.page.evaluate(() => {
          const card = document.querySelector(".exercise.is-current");
          const tip = card.querySelector('[data-tip="max-set"]');
          const prompt = tip.getBoundingClientRect();
          const covered = [".fx-cue", ".ledgerline--open"].filter(selector => {
            const box = card.querySelector(selector).getBoundingClientRect();
            return Math.min(box.right, prompt.right) > Math.max(box.left, prompt.left) + 1 &&
              Math.min(box.bottom, prompt.bottom) > Math.max(box.top, prompt.top) + 1;
          });
          const region = card.querySelector(".fcard__context"), context = region.getBoundingClientRect();
          const cut = [], walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            for (const rect of range.getClientRects())
              if (rect.width > 1 && rect.height > 1 && rect.top < context.top - 0.5 && rect.bottom > context.top + 0.5)
                cut.push({ text: node.textContent.trim(), top: rect.top, bottom: rect.bottom });
          }
          const cardBox = card.getBoundingClientRect(), shelf = card.querySelector(".focus-shelf").getBoundingClientRect();
          const row = card.querySelector(".ledgerline--open").getBoundingClientRect();
          const target = card.querySelector(".fx-cue__l1").getBoundingClientRect();
          return { cut, covered, left: prompt.left, right: prompt.right, width: innerWidth, height: prompt.height,
            rowWhole: row.top >= context.top - 1 && row.bottom <= context.bottom + 1,
            targetWhole: target.top >= cardBox.top - 1 && target.bottom <= shelf.top + 1 };
        });
        if (measured.covered.length || measured.left < 0 || measured.right > measured.width || Math.abs(measured.height - 44) > 0.5)
          failures.push(`${label}: prompt must be one 44px row without covering the target/open row or spilling: ${JSON.stringify(measured)}`);
        if (measured.cut.length) failures.push(`${label}: context must start on a whole line before scrolling: ${JSON.stringify(measured)}`);
        if (!measured.rowWhole || !measured.targetWhole)
          failures.push(`${label}: target and current row must be whole without scrolling: ${JSON.stringify(measured)}`);
        const actions = await opened.page.locator('.exercise.is-current .resttip__acts button').evaluateAll(buttons =>
          buttons.map(button => {
            const box = button.getBoundingClientRect();
            const context = button.closest(".exercise").getBoundingClientRect();
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return { text: button.innerText.trim(), width: box.width, height: box.height,
              whole: box.top >= Math.max(0, context.top) - 1 && box.bottom <= Math.min(innerHeight, context.bottom) + 1 && box.left >= 0 && box.right <= innerWidth,
              reachable: !!hit && button.contains(hit) };
          }));
        if (actions.length !== 2 || actions.some(action => action.width < 44 || action.height < 44 || !action.whole || !action.reachable))
          failures.push(`${label}: both invitation actions must be visible 44px targets: ${JSON.stringify(actions)}`);
        const copy = await opened.page.locator('.exercise.is-current [data-maxset-guess]').evaluate(button => {
          const style = getComputedStyle(button), box = button.getBoundingClientRect();
          const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
          const lines = [];
          while (walker.nextNode()) {
            const node = walker.currentNode, parentStyle = getComputedStyle(node.parentElement);
            if (!node.textContent.trim() || parentStyle.visibility === "hidden" || !node.parentElement.getClientRects().length) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            for (const rect of range.getClientRects()) lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
          }
          return { text: button.innerText.trim(), lines,
            left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight),
            top: box.top, bottom: box.bottom, overflow: button.scrollWidth > button.clientWidth + 1 };
        });
        const full = lang === "en" ? "Test set? Guess your reps" : "Série-teste? Adivinhe suas reps";
        const short = lang === "en" ? "Test set?" : "Série-teste?";
        const expected = width === 320 && text === "text200" ? short : width >= 390 && text === "normal" ? full : null;
        if (![full, short].includes(copy.text) || (expected && copy.text !== expected) || copy.lines.length !== 1 || copy.overflow ||
            copy.lines.some(line => line.left < copy.left - 1 || line.right > copy.right + 1 || line.top < copy.top - 1 || line.bottom > copy.bottom + 1))
          failures.push(`${label}: approved bar copy must fit on one whole, unclipped line (expected ${expected}): ${JSON.stringify(copy)}`);
        const clock = await opened.page.locator("#restTab").evaluate(button => {
          const box = button.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return { width: box.width, height: box.height, whole: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
            reachable: !!hit && button.contains(hit), label: button.getAttribute("aria-label") };
        });
        if (clock.width < 44 || clock.height < 44 || !clock.whole || !clock.reachable || !clock.label)
          failures.push(`${label}: rest clock must remain a named, visible 44px target: ${JSON.stringify(clock)}`);
        const guess = opened.page.locator('.exercise.is-current [data-maxset-guess]');
        if (key.endsWith("prompt") && width === 430 && lang === "pt" && text === "normal") {
          for (const [resizedWidth, expectedText] of [[337, short], [413, full], [430, full]]) {
            await opened.page.setViewportSize({ width: resizedWidth, height: 932 });
            await opened.page.waitForFunction(expected => document.querySelector('.exercise.is-current [data-maxset-guess]').innerText.trim() === expected, expectedText);
            const resized = await guess.evaluate(button => {
              const range = document.createRange(); range.selectNodeContents(button.querySelector(".resttip__label"));
              const text = range.getBoundingClientRect(), box = button.getBoundingClientRect(), style = getComputedStyle(button);
              return { fits: text.left >= box.left + parseFloat(style.paddingLeft) - 1 && text.right <= box.right - parseFloat(style.paddingRight) + 1 && text.top >= box.top && text.bottom <= box.bottom,
                height: button.closest('[data-tip="max-set"]').getBoundingClientRect().height };
            });
            assert(resized.fits && resized.height === 44, `${label}: resized ${resizedWidth}px label fits in one 44px dock`, JSON.stringify(resized));
          }
        }
        await guess.click();
        await opened.page.locator("#maxSetSheet.is-open").waitFor({ state: "visible" });
        assert(await opened.page.evaluate(key => document.querySelector("#maxSetInvite").textContent.includes(
          t(key.endsWith("recheck") ? "maxset.invite_reason_recheck" : "maxset.invite_reason_learning")), key),
          `${label}: the guess sheet keeps the full invitation reason`);
        console.log(`  ${label}: ${JSON.stringify(measured)}`);
      } finally {
        await opened.context.close();
      }
  });
  assert(!failures.length, "test-set prompts leave the target and open row readable", failures.join(" | "));
  console.log("  24 test-set frames keep the target and open row whole, with both bar actions and the rest clock visible before scrolling");
}

async function checkTestSetGuess(browser) {
  const failures = [], cases = [];
  for (const width of [320, 390, 430]) for (const lang of ["en", "pt"]) for (const text of ["normal", "text200"])
    cases.push({ width, lang, text });
  await inPool(cases, 3, async ({ width, lang, text }) => {
    const opened = await openCatalogState(browser, "workout/max-set-guess", width, lang, text,
      { height: width === 430 ? 932 : CATALOG_PHONES[width], safe: { top: 0, bottom: 0 } });
    try {
      const measured = await opened.page.evaluate(() => {
        const sheet = document.querySelector("#maxSetSheet"), results = [];
        const originalPage = scrollY, originalFocus = document.querySelector(".exercise.is-current .fcard__context").scrollTop;
        for (const element of sheet.querySelectorAll(".maxset__count,.maxset__rule,.maxset__safety:not([hidden])")) {
          let scroller = element.parentElement;
          while (scroller !== sheet && !(/auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
          if (scroller !== sheet) {
            const box = element.getBoundingClientRect(), port = scroller.getBoundingClientRect();
            scroller.scrollTop += box.top - port.top - (scroller.clientHeight - box.height) / 2;
          }
          const box = element.getBoundingClientRect(), port = scroller.getBoundingClientRect();
          const foot = sheet.querySelector(".sheetfoot").getBoundingClientRect();
          const top = Math.max(0, port.top, sheet.getBoundingClientRect().top), bottom = Math.min(innerHeight, port.bottom, foot.top);
          const range = document.createRange(); range.selectNodeContents(element);
          const glyphsWhole = [...range.getClientRects()].every(rect => rect.width < 1 || rect.height < 1 ||
            (rect.top >= top - 1 && rect.bottom <= bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1));
          results.push({ name: element.className, top: box.top, bottom: box.bottom, portTop: top, portBottom: bottom,
            whole: glyphsWhole && box.top >= top - 1 && box.bottom <= bottom + 1 && box.left >= 0 && box.right <= innerWidth });
          for (const button of element.querySelectorAll("button")) {
            const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            results.push({ name: button.id, whole: rect.width >= 44 && rect.height >= 44 && !!hit && button.contains(hit) });
          }
        }
        for (const button of sheet.querySelectorAll(".sheetfoot button")) {
          const box = button.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          results.push({ name: button.id, whole: box.height >= 44 && box.width >= 44 && box.top >= 0 && box.bottom <= innerHeight + 1 && !!hit && button.contains(hit) });
        }
        return { results, pageStill: originalPage === scrollY, focusStill: originalFocus === document.querySelector(".exercise.is-current .fcard__context").scrollTop };
      });
      console.log(`  guess ${width}px ${lang} ${text}: ${JSON.stringify(measured)}`);
      if (!measured.pageStill || !measured.focusStill || measured.results.some(result => !result.whole))
        failures.push(`${width}px ${lang} ${text}: ${JSON.stringify(measured)}`);
    } finally { await opened.context.close(); }
  });
  assert(!failures.length, "guess count, controls, guidance and actions fit or are reachable by scrolling inside the sheet", failures.join(" | "));
}

async function checkTestSetDismissal(browser) {
  for (const lang of ["en", "pt"]) {
    const opened = await openCatalogState(browser, "workout/max-set-prompt", 320, lang, "text200", { safe: { top: 0, bottom: 0 } });
    try {
      const time = await opened.page.locator("#restTab .resttab__time").textContent();
      await opened.page.locator('.exercise.is-current [data-maxset-no]').click();
      await opened.page.locator('.exercise.is-current [data-tip="max-set"]').waitFor({ state: "detached" });
      assert(await opened.page.locator("#restTab").count() === 1 && await opened.page.locator(".restlight").count() === 1,
        `${lang}: dismissing the invitation preserves one rest control and contour`);
      const ordinary = await opened.page.locator("#restTab").evaluate(tab => ({
        position: getComputedStyle(tab).position,
        label: getComputedStyle(tab.querySelector(".resttab__label")).display,
        chevron: getComputedStyle(tab.querySelector(".resttab__chev")).display,
        raised: tab.getBoundingClientRect().top < tab.closest(".focus-shelf").getBoundingClientRect().top,
      }));
      assert(ordinary.position === "absolute" && ordinary.label !== "none" && ordinary.chevron !== "none" && ordinary.raised,
        `${lang}: without the test-set bar the ordinary raised rest chip keeps its label and chevron`, JSON.stringify(ordinary));
      assert(await opened.page.locator("#restTab .resttab__time").textContent() === time,
        `${lang}: dismissal preserves the running rest`);
      await opened.page.locator("#restTab").click();
      await opened.page.locator("#restSheet.is-open").waitFor({ state: "visible" });
    } finally {
      await opened.context.close();
    }
  }
}

async function checkLedgerValues(browser) {
  console.log("\nLedger values without scrolling: EN/PT, 320/390px, 200% text");
  const failures = [];
  for (const key of ["workout/effort-stage-a", "workout/focus-ramp", "workout/focus-ramp-ratio", "workout/focus"])
    for (const width of [390, 320]) for (const lang of ["pt", "en"]) {
      const text = "text200";
      const label = `${key} ${width}px ${lang} ${text}`;
      const opened = await openCatalogState(browser, key, width, lang, text,
        width === 320 ? { safe: { top: 0, bottom: 0 } } : {});
      try {
        const m = await opened.page.evaluate(() => {
          const card = document.querySelector(".exercise.is-current");
          const row = card.querySelector(".ledgerline--open");
          const context = card.querySelector(".fcard__context");
          if (!row) return { error: "no current ledger row" };
          const box = el => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          };
          return { row: box(row), context: box(context), width: innerWidth, height: innerHeight,
            cells: [...row.querySelectorAll(".ledgerline__vals > .fx-col")].map(el => {
              const range = document.createRange();
              range.selectNodeContents(el);
              return { text: el.textContent.trim(), box: box(el),
                lines: [...range.getClientRects()].filter(r => r.width > 0).map(r =>
                  ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })) };
            }) };
        });
        const problems = [];
        if (m.error) problems.push(m.error);
        else {
          if (m.cells.length !== 3 || m.cells.some(cell => !cell.text)) problems.push("missing load, reps or effort");
          if (key !== "workout/focus" && !m.cells.some(cell => cell.text === (lang === "pt" ? "Difícil" : "Hard")))
            problems.push("the words-stage fixture must show the reported effort word");
          for (const cell of m.cells) {
            if (cell.lines.length !== 1) problems.push(`${cell.text} wraps`);
            for (const line of cell.lines) {
              if (line.left < cell.box.left - 0.5 || line.right > cell.box.right + 0.5)
                problems.push(`${cell.text} spills outside its column`);
              for (const [name, bounds] of [["row", m.row], ["context", m.context],
                ["viewport", { left: 0, right: m.width, top: 0, bottom: m.height }]])
                if (line.left < bounds.left - 0.5 || line.right > bounds.right + 0.5 ||
                  line.top < bounds.top - 0.5 || line.bottom > bounds.bottom + 0.5)
                  problems.push(`${cell.text} is clipped by the ${name}`);
            }
          }
        }
        if (problems.length) failures.push({ label, problems, geometry: m });
        else console.log(`  ✓ ${label}: load, reps and effort are whole without scrolling`);
      } finally { await opened.context.close(); }
    }
  assert(!failures.length, "ledger values stay whole without scrolling", JSON.stringify(failures));
}

async function main() {
  const browser = await launchChromium();

  try {
    /* ======================================================================
     * 1. Geometry Stability: Title & Timer at PT + 200% scaling
     * ====================================================================== */
    console.log("\nGeometry Stability: PT + 200% text scaling across viewports (320, 390, 430)");
    if (wants("stability")) for (const width of [320, 390, 430]) for (const lang of ["en", "pt"]) for (const theme of ["light", "dark"]) for (const scale of [1, 2]) {
      const height = { 320: 568, 390: 844, 430: 932 }[width];
      const context = await browser.newContext({
        viewport: { width, height },
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 44, bottom: 34, left: 0, right: 0 } });

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true);

      // Seed program and set Portuguese locale
      await installSeedProgram(page, {
        key: STATE_KEY,
        waitFor: async (p) => p.waitForFunction(() => window.__repforgeBooted === true),
      });

      await page.evaluate(async () => {
        const state = JSON.parse(localStorage.getItem("repforge_v1"));
        const ex = state.program[0];
        const date = new Date(); date.setDate(date.getDate() - 7);
        state.log = [1, 2].map(set => ({ date: date.toISOString().slice(0, 10), day: ex.day,
          exerciseId: ex.id, name: ex.name, set, load: 60, reps: 8, rir: 2,
          programId: state.programMeta.id, sessionId: "geometry-previous" }));
        localStorage.setItem("repforge_v1", JSON.stringify(state));
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open("repforge", 1);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        await new Promise((resolve, reject) => { const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(state, "repforge_v1"); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        db.close();
      });
      await page.reload();
      await page.waitForFunction(() => window.__repforgeBooted);
      await page.locator("#openSettings").click();
      await page.locator("#langRow").click(); await page.locator(`#nativeContextMenu [data-menu-value="${lang}"]`).click();
      await page.waitForFunction(lang => document.documentElement.lang === (lang === "pt" ? "pt-BR" : "en"), lang);
      await page.waitForFunction(lang => JSON.parse(localStorage.getItem("repforge_v1"))?.settings?.lang === lang, lang);
      await page.evaluate(({ theme, scale }) => {
        window.__repforgeUi.setTheme(theme);
        document.documentElement.style.fontSize = `${scale * 100}%`;
      }, { theme, scale });
      assert(await page.locator("html").getAttribute("lang") === (lang === "pt" ? "pt-BR" : "en"), "actual document language matches fixture");
      await page.locator("#settingsBack").click();
      // Enter Focus workout
      await page.locator("#startWorkout").click();
      await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
      await page.waitForTimeout(350);

      // Measure title bounding box when timer is idle
      const titleEl = page.locator(".wo-head__title");
      const titleIdleBox = await titleEl.boundingBox();
      assert(titleIdleBox != null && titleIdleBox.width > 0, `title exists and has width at ${width}px PT+200%`);

      // Start the rest timer (the rest timer redesign: it rises as a tab over the shelf, never in the header)
      await page.evaluate(() => window.startRest());
      await page.waitForSelector("#restTab");

      // Measure title bounding box while timer is running
      const titleRunningBox = await titleEl.boundingBox();
      const shiftX = Math.abs(titleRunningBox.x - titleIdleBox.x);
      const shiftY = Math.abs(titleRunningBox.y - titleIdleBox.y);

      console.log(`${width}px ${lang} ${theme} ${scale * 100}%: timer title shift ${shiftX.toFixed(2)}, ${shiftY.toFixed(2)}`);
      assert(shiftX <= 1.0, `title X must remain stable when timer runs at ${width}px PT+200% (shift: ${shiftX.toFixed(2)}px)`);
      assert(shiftY <= 1.0, `title Y must remain stable when timer runs at ${width}px PT+200% (shift: ${shiftY.toFixed(2)}px)`);

      // Check controls are not clipped
      const headEndBox = await page.locator(".wo-head__end").boundingBox();
      const leaveBox = await page.locator("#leaveWorkout").boundingBox();
      assert(leaveBox.x >= 0, `leave button is not clipped off-screen at ${width}px`);
      assert(headEndBox.x + headEndBox.width <= width + 1, `header controls do not overflow viewport at ${width}px`);

      // Check previous-session band minimum / existence
      const prevBand = page.locator(".exercise.is-current .fcard__ledger");
      await prevBand.scrollIntoViewIfNeeded();
      const firstPreviousRow = prevBand.locator(".ledgerline--two").first();
      await firstPreviousRow.scrollIntoViewIfNeeded();
      const prevBandBox = await prevBand.boundingBox();
      const contextBox = await page.locator(".exercise.is-current .fcard__context").boundingBox();
      assert(await prevBand.locator(".ledgerline__prev").count() === 2, "previous-session proof uses actual history");
      const firstPrevious = await firstPreviousRow.boundingBox();
      if (width === 320 && scale === 2) {
        // Double-size text on the narrowest screen: the shelf keeps its three fields, pads and action whole, and
        // the ledger above it is a short window onto rows taller than itself, so the proof is that it scrolls.
        const ledgerWindow = await page.locator(".exercise.is-current .fcard__context").evaluate(el => ({ scrolls: el.scrollHeight > el.clientHeight + 1 }));
        assert(ledgerWindow.scrolls, `the ledger scrolls to its rows at ${width}px with double-size text`, JSON.stringify(ledgerWindow));
      } else {
        assert(prevBandBox != null && firstPrevious.y >= contextBox.y && firstPrevious.y + firstPrevious.height <= Math.min(prevBandBox.y + prevBandBox.height, contextBox.y + contextBox.height) + 1,
          `at least one complete row with its previous-session line remains readable at ${width}px`);
      }
      const safe = await page.evaluate(() => {
        const head = document.querySelector(".wo-head").getBoundingClientRect();
        const action = document.querySelector(".exercise.is-current [data-save]").getBoundingClientRect();
        return { top: head.top, bottom: action.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(safe.top >= 44 && safe.bottom <= height - 34 && !safe.overflow,
        `header and primary action respect emulated safe areas at ${width}px`, JSON.stringify(safe));

      await page.close();
      await context.close();
    }

    /* ======================================================================
     * 2. The shelf's action stays whole at large text (R7 V-02)
     * ====================================================================== */
    if (wants("effort")) await checkLedgerValues(browser);
    if (wants("dismissal")) await checkTestSetDismissal(browser);
    if (wants("test-set")) await checkTestSetPrompt(browser);
    if (wants("guess")) await checkTestSetGuess(browser);
    if (wants("context")) await checkContextText(browser);
    if (wants("large")) await checkFocusStatesAtLargeText(browser);
    if (only.includes("standing")) { await checkStandingLedger(browser); await checkOpeningStandingLedger(browser); }
    if (wants("smallest")) {
      await checkFocusAtSmallestPhone(browser);
      await checkStandingLedger(browser);
      await checkOpeningStandingLedger(browser);
    }
    if (!wants("gestures")) return;

    /* ======================================================================
     * 3. Gesture Controller Lifetime
     * ====================================================================== */
    console.log("\nGesture Controller Lifetime: explicit mount, disposal, safety");
    const testPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await testPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await testPage.waitForFunction(() => window.__repforgeBooted === true);

    const gestureContract = await testPage.evaluate(() => {
      const motion = window.RepForgeMotion;
      if (!motion || typeof motion.mountGestureController !== "function") {
        return { exists: false };
      }

      // 1. First mount
      const controller1 = motion.mountGestureController();
      const hasDispose = typeof controller1?.dispose === "function";

      // 2. Double mount: idempotent, returns same active controller or safe handle
      const controller2 = motion.mountGestureController();
      const doubleMountSafe = controller1 === controller2;

      // 3. Disposal
      controller1.dispose();

      // 4. Safe re-mount after dispose
      const controller3 = motion.mountGestureController();
      const canRemount = typeof controller3?.dispose === "function";

      controller3.dispose();

      return {
        exists: true,
        hasDispose,
        doubleMountSafe,
        canRemount,
      };
    });

    assert(gestureContract.exists, "window.RepForgeMotion exposes mountGestureController");
    assert(gestureContract.hasDispose, "gesture controller returns disposal handle with dispose()");
    assert(gestureContract.doubleMountSafe, "double mount is safe and idempotent");
    assert(gestureContract.canRemount, "controller can be re-mounted cleanly after disposal");

    await testPage.close();
    for (const runtime of ["motion", "fallback", "no-layer"]) for (const reduced of [false, true]) {
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block",reducedMotion:reduced?"reduce":"no-preference"});
      const page=await context.newPage();
      page.setDefaultTimeout(10000);
      if(runtime!=="motion")await page.route("**/vendor/motion/motion.js",route=>route.abort());
      if(runtime==="no-layer")await page.route("**/motion-layer.js*",route=>route.abort());
      await page.goto(BASE_URL);
      await page.waitForFunction(()=>window.__repforgeBooted);
      await installSeedProgram(page,{waitFor:p=>p.waitForFunction(()=>window.__repforgeBooted)});
      await page.locator("#startWorkout").click();
      await page.locator("#workout .exercise.is-current").waitFor({state:"visible"});
      const cancel=await page.evaluate(async()=>{
        const start=window.__repforgeFocus.at();
        const card=document.querySelector(".exercise.is-current");
        card.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:19,pointerType:"touch",clientX:280,clientY:250}));
        window.dispatchEvent(new PointerEvent("pointermove",{pointerId:19,pointerType:"touch",clientX:80,clientY:250}));
        window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:19,pointerType:"touch",clientX:80,clientY:250}));
        await new Promise(resolve=>setTimeout(resolve,400));
        return {start,end:window.__repforgeFocus.at()};
      });
      assert(cancel.start===cancel.end,`${runtime} reduced=${reduced}: pointercancel never navigates`);
      await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
      await page.waitForFunction(()=>window.__repforgeFocus.at()===1);
      const disposal=await page.evaluate(async()=>{
        const handle=window.__repforgeGestureHandle;
        if(!matchMedia("(prefers-reduced-motion: reduce)").matches)handle.navigate(1);
        const at=window.__repforgeFocus.at();
        handle.dispose();handle.dispose();
        await new Promise(resolve=>setTimeout(resolve,450));
        const after=window.__repforgeFocus.at();
        window.__repforgeGestureHandle=window.RepForgeMotion?.mountGestureController()||window.mountFallbackGestures();
        return {at,after,clean:!document.querySelector("#focusDeck.is-swiping, .exercise.is-dragging")};
      });
      assert(disposal.at===disposal.after && disposal.clean,`${runtime} reduced=${reduced}: disposal cancels pending navigation and gesture state`);
      await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
      await page.waitForFunction(()=>window.__repforgeFocus.at()===2);
      await context.close();
    }

    console.log("\nAll Focus geometry and gesture lifetime assertions passed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nFocus geometry proof failed:", err);
  process.exit(1);
});
