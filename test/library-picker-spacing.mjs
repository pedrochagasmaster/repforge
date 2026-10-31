#!/usr/bin/env node
/**
 * The Library's Add exercises screen keeps its spacing (owner, iPhone, 2026-10-31:
 * borders touching, chip labels off centre, chips cut at the edge).
 *
 * At 390 and 320 wide, in English and Portuguese, at 100% and 200% text:
 *   - no two filter pills touch: at least 8px between neighbours in a rail and
 *     between the two rails, and the first rail clears the tabs' hairline;
 *   - each pill's label is centred in its pill within 1px, both ways;
 *   - a pill is at least 32px tall and its target at least 44px;
 *   - nothing interactive outside the rails touches the screen edge (16px inset);
 *     the rails run to the screen edge, fade there, and start their first pill
 *     on the content edge.
 * The pill is the chip's ::before box (styles.css, .pchip), so the measurements
 * are of what is drawn, not of the 44px target.
 *
 * Run: node test/library-picker-spacing.mjs   (requires the app served over HTTP)
 */
import { launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

/** Runs in the page: the drawn geometry of the picker's rails, chips and controls. */
function measure() {
  const vw = document.documentElement.clientWidth;
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const pill = (chip) => {
    const outer = chip.getBoundingClientRect(), before = getComputedStyle(chip, "::before");
    return { l: outer.left + parseFloat(before.left), r: outer.right - parseFloat(before.right),
      t: outer.top + parseFloat(before.top), b: outer.bottom - parseFloat(before.bottom), target: box(outer) };
  };
  const rails = [...document.querySelectorAll("#libFilters .pick__filters--row")].map((rail) => {
    const chips = [...rail.querySelectorAll(".pchip")].map((chip) => {
      const range = document.createRange(); range.selectNodeContents(chip);
      const text = range.getBoundingClientRect(), p = pill(chip);
      return { label: chip.textContent.trim(), pill: p,
        dx: (text.left + text.right) / 2 - (p.l + p.r) / 2, dy: (text.top + text.bottom) / 2 - (p.t + p.b) / 2 };
    });
    const cs = getComputedStyle(rail);
    return { id: rail.id, box: box(rail.getBoundingClientRect()), mask: cs.maskImage !== "none" ? cs.maskImage : cs.webkitMaskImage,
      paddingLeft: parseFloat(cs.paddingLeft), chips };
  });
  const insideRail = (el) => !!el.closest("#libFilters");
  const controls = [...document.querySelectorAll("#library button, #library input, #library [role=tab]")]
    .filter((el) => !insideRail(el) && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
    .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
    .map((el) => ({ id: el.id || el.className.split(" ")[0], ...box(el.getBoundingClientRect()) }));
  return { vw, rails, controls, tabs: box(document.querySelector("#libTabs").getBoundingClientRect()),
    search: box(document.querySelector("#libSearch").getBoundingClientRect()) };
}

const manifest = loadManifest();
const browser = await launchChromium();
try {
  for (const viewport of ["phone-390", "phone-320"]) {
    for (const locale of ["en", "pt"]) {
      for (const text of ["normal", "text200"]) {
        const tag = `${viewport} ${locale} ${text}`;
        console.log(`\n${tag}`);
        const capture = { flow: "library", screen: "list", viewport, theme: "light", locale, text, motion: "normal" };
        const opened = await openPage(browser, manifest, capture, appState("library/list", manifest.locales[locale].lang));
        try {
          await dismissChrome(opened.page);
          await APP_SCENARIOS["library/list"](opened.page);
          await settle(opened.page);
          const m = await opened.page.evaluate(measure);
          assert(m.rails.length === 2 && m.rails.every((rail) => rail.chips.length > 2), `${tag}: two filter rails with their chips`, JSON.stringify(m.rails.map((r) => r.chips.length)));
          const gaps = m.rails.flatMap((rail) => rail.chips.slice(1).map((chip, i) => ({ rail: rail.id, between: `${rail.chips[i].label}|${chip.label}`, gap: chip.pill.l - rail.chips[i].pill.r })));
          const tight = gaps.filter((item) => item.gap < 8 - 0.5);
          assert(tight.length === 0, `${tag}: neighbouring pills stand at least 8px apart`, JSON.stringify(tight.slice(0, 4)));
          const rowGap = m.rails[1].chips[0].pill.t - Math.max(...m.rails[0].chips.map((chip) => chip.pill.b));
          assert(rowGap >= 8 - 0.5, `${tag}: the two rails' pills stand at least 8px apart`, rowGap.toFixed(1));
          const tabsGap = Math.min(...m.rails[0].chips.map((chip) => chip.pill.t)) - m.tabs.b;
          assert(tabsGap >= 8 - 0.5, `${tag}: the first rail clears the tabs' hairline by at least 8px`, tabsGap.toFixed(1));
          const chips = m.rails.flatMap((rail) => rail.chips);
          const offCentre = chips.filter((chip) => Math.abs(chip.dx) > 1 || Math.abs(chip.dy) > 1);
          assert(offCentre.length === 0, `${tag}: every pill's label is centred within 1px`, JSON.stringify(offCentre.slice(0, 3).map((c) => ({ label: c.label, dx: c.dx.toFixed(2), dy: c.dy.toFixed(2) }))));
          const short = chips.filter((chip) => chip.pill.b - chip.pill.t < 32 - 0.5 || chip.pill.target.b - chip.pill.target.t < 44 - 0.01);
          assert(short.length === 0, `${tag}: pills are at least 32px tall on 44px targets`, JSON.stringify(short.slice(0, 3)));
          const edge = m.controls.filter((control) => control.l < 16 - 0.5 || control.r > m.vw - 16 + 0.5);
          assert(edge.length === 0, `${tag}: no control outside the rails comes within 16px of the screen edge`, JSON.stringify(edge.slice(0, 4)));
          const railsOk = m.rails.every((rail) => Math.abs(rail.box.l) < 0.5 && Math.abs(rail.box.r - m.vw) < 0.5 && /gradient/.test(rail.mask || "")
            && Math.abs(rail.chips[0].pill.l - m.search.l) < 0.5);
          assert(railsOk, `${tag}: the rails reach the screen edge, fade there, and start on the content edge`,
            JSON.stringify(m.rails.map((rail) => ({ id: rail.id, box: rail.box, mask: (rail.mask || "").slice(0, 24), first: rail.chips[0].pill.l, search: m.search.l }))));
        } finally {
          await opened.context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
