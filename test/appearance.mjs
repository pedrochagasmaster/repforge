#!/usr/bin/env node
/**
 * Focused Playwright checks for the Appearance setting (system/light/dark).
 * Requires http://localhost:8000/
 *
 * The theme is a UI pref that resolves to one attribute, so what is worth
 * holding is the edge of that: that the default is light regardless of the
 * device, that choosing System makes the app follow the device until the
 * lifter overrides it, that an explicit choice outlives a reload and reaches
 * the page before app.js does, that the canvas chart is repainted rather than
 * left showing the old palette, that browser chrome tracks the paper, and
 * that none of it leaks into the training state or a setup link.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";
import { MINIMAL_PAYLOAD, BUILT_IN_IDS, cloneFixture } from "./fixtures/shared-setup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const UIKEY = "repforge_ui_v1";
const APP_JS = /\/app\.js(\?|$)/;

const results = { passed: 0, failed: 0 };

function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 10000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
  await page.waitForFunction(() => typeof window.__repforgeUi?.setTheme === "function", { timeout: 10000 });
}

/** A page with no stored preference, on a device claiming `scheme`. */
async function freshPage(browser, scheme) {
  const context = await browser.newContext({ colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(({ k, ui }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(ui);
  }, { k: KEY, ui: UIKEY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const metaColor = (page) =>
  page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"));
const storedTheme = (page) =>
  page.evaluate((ui) => {
    try { return (JSON.parse(localStorage.getItem(ui)) || {}).theme ?? null; } catch { return null; }
  }, UIKEY);

async function openSettings(page) {
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await page.waitForSelector("#theme");
}

// ---- Contrast ---------------------------------------------------------------
// The dark palette is new copy on a new ground, so the pairs the light theme was
// tuned against are re-measured rather than assumed.
const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(rgb) {
  const [r, g, b] = rgb;
  return 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function parseColor(value) {
  const m = String(value).trim().match(/^#?([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const rgb = String(value).match(/(\d+(?:\.\d+)?)/g);
  if (!rgb || rgb.length < 3) throw new Error(`cannot parse colour: ${value}`);
  return rgb.slice(0, 3).map(Number);
}
const colorDistance = (a, b) =>
  Math.sqrt(a.reduce((sum, channelValue, i) => sum + (channelValue - b[i]) ** 2, 0));
const readTokens = (page, names) =>
  page.evaluate((list) => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(list.map((n) => [n, css.getPropertyValue(n).trim()]));
  }, names);

// Foreground / background / minimum ratio. 4.5 is AA for body text.
const CONTRAST_PAIRS = [
  ["--ink", "--bg", 7],
  ["--ink", "--surface", 7],
  ["--ink-soft", "--surface", 4.5],
  ["--ink-faint", "--surface", 4.5],
  ["--ink-faint", "--bg", 4.5],
  ["--accent-deep", "--surface", 4.5],
  ["--accent-ink", "--accent-deep", 4.5],
  ["--cta-ink", "--cta", 4.5],
  ["--danger", "--surface", 4.5],
  ["--positive", "--surface", 4.5],
];

async function checkContrast(page, label) {
  const names = [...new Set(CONTRAST_PAIRS.flat().filter((n) => typeof n === "string"))];
  const tokens = await readTokens(page, names);
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    const ratio = contrast(parseColor(tokens[fg]), parseColor(tokens[bg]));
    assert(
      ratio >= min,
      `${label}: ${fg} on ${bg} is at least ${min}:1`,
      `measured ${ratio.toFixed(2)}:1 (${tokens[fg]} on ${tokens[bg]})`
    );
  }
}

// ---- The palette is the only place a colour lives ---------------------------
// A rule that names a colour instead of a token is invisible in light and
// broken in dark — the select chevron shipped its ink inside an SVG data URL
// and vanished on the dark ground. So the stylesheet is read as text: outside
// the two :root blocks, only these literals are allowed to remain.
//
// Shadows are black in both themes because their job is to darken what is
// behind them, and the two plates carry the app icon's own warm ground.
const LITERAL_ALLOWLIST = [
  { re: /rgba\(0,0,0,[.\d]+\)/g, why: "shadow" },
  { re: /rgba\(27,26,23,[.\d]+\)/g, why: "shadow" },
  { re: /rgba\(23,23,25,[.\d]+\)/g, why: "shadow" },
  { re: /#161513(?=\s+url)/g, why: "install-banner icon plate" },
  { re: /#efe5df/g, why: "settings identity icon plate" },
];

function stylesheetOutsideTokens() {
  const css = readFileSync(join(ROOT, "styles.css"), "utf8");
  // Both palettes are one top-level block each, so the first "\n}" closes them.
  let out = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const open of [":root{", ':root[data-theme="dark"]{']) {
    const start = out.indexOf(open);
    if (start < 0) throw new Error(`${open} not found in styles.css`);
    const end = out.indexOf("\n}", start);
    if (end < 0) throw new Error(`${open} is unterminated`);
    out = out.slice(0, start) + out.slice(end + 2);
  }
  // A component-scoped custom property is still a token — --exercise-art-bg is
  // the paper the licensed artwork sits on, and it is theme-independent on
  // purpose. What the scan is after is a *rule* naming a colour.
  return out.replace(/--[\w-]+\s*:[^;}]*/g, "");
}

function runPaletteIsTheOnlyPlace() {
  console.log("\n0. Every colour outside the two palettes is a token");
  const body = stylesheetOutsideTokens();

  // Colours escaped into SVG data URLs. A mask takes its colour from
  // currentColor and only needs a shape, so `black` there is fine; a %23 hex is
  // ink that cannot follow the theme.
  const escaped = [...body.matchAll(/%23[0-9a-fA-F]{3,6}/g)].map((m) => m[0]);
  assert(!escaped.length, "No colour is baked into an SVG data URL", escaped.join(", "));

  let scrubbed = body;
  for (const { re } of LITERAL_ALLOWLIST) scrubbed = scrubbed.replace(re, "");
  // Mask shapes are declared with a literal `black`/`white` stroke or fill.
  scrubbed = scrubbed.replace(/data:image\/svg\+xml,[^"')]+/g, "");

  const literals = [
    ...scrubbed.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
    ...scrubbed.matchAll(/\b(?:rgba?|hsla?)\(\s*[\d.]/g),
  ].map((m) => m[0]);
  assert(
    !literals.length,
    "No rule outside the palettes names a colour",
    literals.slice(0, 12).join(", ")
  );

  // The allowlist should shrink, never quietly become dead weight.
  const unused = LITERAL_ALLOWLIST.filter(({ re }) => !new RegExp(re.source).test(body));
  assert(!unused.length, "Every allowlisted literal is still in use", unused.map((u) => u.why).join(", "));
}

// ---- Suites -----------------------------------------------------------------

async function runLightDefault(browser) {
  console.log("\n1. With no preference stored, the default is light on any device");
  for (const scheme of ["dark", "light"]) {
    const { context, page } = await freshPage(browser, scheme);
    try {
      assert(await themeOf(page) === "light", `A ${scheme} device still boots light`, await themeOf(page));
      assert(await storedTheme(page) === null, `A ${scheme} device stores nothing`, await storedTheme(page));
      await openSettings(page);
      assert(
        await page.inputValue("#theme") === "light",
        `The ${scheme} device shows "Light" selected`,
        await page.inputValue("#theme")
      );
    } finally {
      await context.close();
    }
  }
}

async function runFollowsSystemLive(browser) {
  console.log("\n2. Choosing System makes the app follow the device without a reload");
  const { context, page } = await freshPage(browser, "light");
  try {
    assert(await themeOf(page) === "light", "Starts light by default");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(100);
    assert(await themeOf(page) === "light", "A dark device alone does not repaint the default", await themeOf(page));

    await page.evaluate(() => window.__repforgeUi.setTheme("system"));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", { timeout: 3000 });
    assert(true, "Once System is chosen, the device turning dark repaints the app");
    assert(await metaColor(page) === "#141310", "theme-color follows it", await metaColor(page));

    // An explicit choice ends the following: the device is no longer the answer.
    await page.evaluate(() => window.__repforgeUi.setTheme("light"));
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(100);
    assert(await themeOf(page) === "light", "An explicit Light ignores a dark device", await themeOf(page));
  } finally {
    await context.close();
  }
}

async function runSettingsRow(browser) {
  console.log("\n3. Choosing a theme in Settings applies and persists it");
  const { context, page } = await freshPage(browser, "light");
  try {
    await openSettings(page);
    await page.selectOption("#theme", "dark");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", { timeout: 3000 });
    assert(true, "Picking Dark repaints immediately");
    assert(await storedTheme(page) === "dark", "Dark is stored in repforge_ui_v1", await storedTheme(page));
    assert(await metaColor(page) === "#141310", "theme-color is the dark paper", await metaColor(page));

    const painted = await page.evaluate(() => {
      const css = getComputedStyle(document.body);
      return { bg: css.backgroundColor, ink: css.color };
    });
    const bgLum = luminance(parseColor(painted.bg));
    const inkLum = luminance(parseColor(painted.ink));
    assert(bgLum < 0.05 && inkLum > 0.5, "The page is painted light-on-dark", JSON.stringify(painted));
    await checkContrast(page, "Dark");
    const refined = await readTokens(page, ["--accent-deep", "--danger", "--cta", "--ink"]);
    const semanticDistance = colorDistance(
      parseColor(refined["--accent-deep"]),
      parseColor(refined["--danger"])
    );
    assert(
      semanticDistance >= 50,
      "Dark emphasis and danger are visibly distinct hues",
      `${semanticDistance.toFixed(1)} RGB units: ${refined["--accent-deep"]} / ${refined["--danger"]}`
    );
    assert(
      luminance(parseColor(refined["--cta"])) < luminance(parseColor(refined["--ink"])),
      "The dark CTA is parchment, not the brightest white ink",
      `${refined["--cta"]} / ${refined["--ink"]}`
    );
    const settingsFill = await page.evaluate(
      () => getComputedStyle(document.querySelector(".settings-group")).backgroundColor
    );
    assert(
      settingsFill === "rgba(0, 0, 0, 0)",
      "Dark Settings groups remain ink and rules on paper, not filled cards",
      settingsFill
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    assert(await themeOf(page) === "dark", "Dark survives a reload", await themeOf(page));
    await openSettings(page);
    assert(await page.inputValue("#theme") === "dark", "The row reopens on Dark", await page.inputValue("#theme"));

    await page.selectOption("#theme", "light");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 });
    assert(await metaColor(page) === "#F4F2EF", "theme-color returns to cream", await metaColor(page));
    await checkContrast(page, "Light");

    await page.selectOption("#theme", "system");
    await page.waitForTimeout(100);
    assert(await storedTheme(page) === "system", "System is stored explicitly", await storedTheme(page));
    assert(await themeOf(page) === "light", "System resolves against the light device", await themeOf(page));
  } finally {
    await context.close();
  }
}

async function runPrePaint(browser) {
  console.log("\n4. The stored theme reaches the page before app.js");
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeUi.setTheme("dark"));

    // With app.js never delivered, only the inline snippet in <head> can have
    // painted the document — which is the whole point of it existing. The tag
    // carries a cache-busting revision, so match the query too.
    await page.route(APP_JS, (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    assert(
      await page.evaluate(() => typeof window.__repforgeUi) === "undefined",
      "app.js really was blocked for this check"
    );
    assert(await themeOf(page) === "dark", "The document is dark without app.js", await themeOf(page));
    assert(await metaColor(page) === "#141310", "So is theme-color", await metaColor(page));
    await page.unroute(APP_JS);

    // The snippet must not invent a preference of its own: cleared, it falls
    // back to light even though the device itself is dark.
    await page.evaluate((ui) => localStorage.removeItem(ui), UIKEY);
    await page.route(APP_JS, (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    assert(
      await themeOf(page) === "light",
      "Cleared, it falls back to the markup default on a light device",
      await themeOf(page)
    );
  } finally {
    await context.close();
  }
}

async function runChartRepaint(browser) {
  console.log("\n5. The canvas chart is repainted, not left on the old palette");
  const { context, page } = await freshPage(browser, "light");
  try {
    await page.click('nav button[data-view="stats"]');
    await page.waitForSelector("#stats.view.active");
    await page.waitForFunction(() => {
      const c = document.querySelector("#chart");
      return c && c.width > 0;
    }, { timeout: 5000 });

    const shot = () => page.evaluate(() => document.querySelector("#chart").toDataURL());
    const before = await shot();
    await page.evaluate(() => window.__repforgeUi.setTheme("dark"));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", { timeout: 3000 });
    const after = await shot();
    assert(before !== after, "Switching to Dark redraws the chart", `${before.length} vs ${after.length} bytes`);

    await page.evaluate(() => window.__repforgeUi.setTheme("light"));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 });
    assert(await shot() === before, "Switching back restores the light drawing");
  } finally {
    await context.close();
  }
}

async function runStaysOutOfTrainingData(browser) {
  console.log("\n6. Appearance stays out of the training state and setup links");
  const { context, page } = await freshPage(browser, "light");
  try {
    await openSettings(page);
    await page.selectOption("#theme", "dark");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", { timeout: 3000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());

    const settings = await page.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k))?.settings ?? null; } catch { return null; }
    }, KEY);
    assert(settings != null, "The state replica is readable", JSON.stringify(settings));
    assert(
      settings != null && !("theme" in settings),
      "No theme key reached repforge_v1 settings",
      JSON.stringify(settings && Object.keys(settings))
    );

    // A coach who hand-edits a theme into a payload should not repaint the
    // recipient's app: the eight-setting allowlist has no room for it.
    const proposed = cloneFixture(MINIMAL_PAYLOAD);
    proposed.settings = { ...proposed.settings, theme: "dark" };
    const validated = await page.evaluate(
      ({ raw, ids }) => {
        const checked = window.RepForgeSharedSetup.validate(raw, { builtInIds: new Set(ids) });
        return {
          ok: checked.ok,
          keys: checked.ok ? Object.keys(checked.value.settings) : null,
          issues: checked.issues || checked.code,
        };
      },
      { raw: proposed, ids: [...BUILT_IN_IDS] }
    );
    assert(validated.ok, "The probe payload is otherwise valid", JSON.stringify(validated));
    assert(
      validated.ok && !validated.keys.includes("theme"),
      "A setup link cannot carry a theme",
      JSON.stringify(validated.keys)
    );
  } finally {
    await context.close();
  }
}

/** Settings used to be a stack of cards in light and a plain list in dark, so
 *  the two themes disagreed about what a group even was. They are one list now,
 *  and the measurements that make it read as a list belong to both. */
const settingsGeometry = (page) =>
  page.evaluate(() => {
    const view = document.querySelector("#settings");
    const captions = [...view.querySelectorAll(".settings-group__label")];
    const groups = [...view.querySelectorAll(".settings-group")];
    const boxed = groups.filter((g) => {
      const s = getComputedStyle(g);
      return s.borderTopWidth !== "0px" || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
    }).length;
    const rows = [...groups[0].querySelectorAll(".settings-row")];
    const rule = getComputedStyle(rows[1], "::before");
    const x = (el) => +el.getBoundingClientRect().left.toFixed(1);
    return {
      boxed,
      captionX: x(captions[0]),
      rowLabelX: x(rows[0].querySelector(".settings-row__label")),
      groupX: x(groups[0]),
      ruleLeft: rule.left,
      ruleRight: rule.right,
      // The space above a caption is the only boundary between two groups now.
      gapAbove: +(captions[1].getBoundingClientRect().top - groups[0].getBoundingClientRect().bottom).toFixed(1),
      gapBelow: +(groups[0].getBoundingClientRect().top - captions[0].getBoundingClientRect().bottom).toFixed(1),
    };
  });

async function runSettingsReadsAsOneList(browser) {
  console.log("\n7. Settings is the same list in both themes");
  const seen = {};
  for (const scheme of ["light", "dark"]) {
    const { context, page } = await freshPage(browser, scheme);
    try {
      await openSettings(page);
      const g = await settingsGeometry(page);
      seen[scheme] = g;
      assert(g.boxed === 0, `No settings group is drawn as a box (${scheme})`, JSON.stringify(g));
      assert(
        g.captionX === g.rowLabelX,
        `A group's caption starts where its rows' labels start (${scheme})`,
        JSON.stringify({ caption: g.captionX, row: g.rowLabelX })
      );
      assert(
        g.ruleLeft === "16px" && g.ruleRight === "0px",
        `The rule between rows is held to the text column, not run edge to edge (${scheme})`,
        JSON.stringify({ left: g.ruleLeft, right: g.ruleRight })
      );
      assert(
        g.gapAbove >= g.gapBelow * 3,
        `The space above a caption reads as the boundary the box used to draw (${scheme})`,
        JSON.stringify({ above: g.gapAbove, below: g.gapBelow })
      );
    } finally {
      await context.close();
    }
  }
  assert(
    JSON.stringify(seen.light) === JSON.stringify(seen.dark),
    "Light and dark lay Settings out identically",
    JSON.stringify(seen)
  );
}

async function main() {
  console.log("Appearance / dark theme");
  console.log(`Target: ${BASE}`);
  runPaletteIsTheOnlyPlace();
  const browser = await launchChromium();
  try {
    await runLightDefault(browser);
    await runFollowsSystemLive(browser);
    await runSettingsRow(browser);
    await runPrePaint(browser);
    await runChartRepaint(browser);
    await runStaysOutOfTrainingData(browser);
    await runSettingsReadsAsOneList(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

main().catch((error) => {
  console.error("Appearance checks crashed:", error);
  process.exit(2);
});
