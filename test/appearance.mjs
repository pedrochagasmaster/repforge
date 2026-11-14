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
import { legacyRelease } from "./fixtures/legacy-release.mjs";
import { buildSetupDocument } from "./shared-setup-flow.mjs";

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
  await page.waitForSelector("#themeSegments");
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
// Raster shadows stay black in both themes; the Settings identity mark is the
// only remaining artwork plate outside the theme palettes.
const LITERAL_ALLOWLIST = [
  { re: /rgba\(23,23,25,[.\d]+\)/g, why: "shadow" },
  { re: /#efe5df/g, why: "settings identity icon plate" },
];

function stylesheetOutsideTokens() {
  const css = readFileSync(join(ROOT, "styles.css"), "utf8");
  // Both palettes are one top-level block each, so the first "\n}" closes them.
  let out = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // `.theme-light` shares the light block: it scopes that palette to one element (the landing proof's phone).
  for (const open of [":root,.theme-light{", ':root[data-theme="dark"]{']) {
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
    await page.locator('#themeSegments [data-value="dark"]').click();
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
      // Owner hill-climb (2026-11-10, DESIGN.md "CTA Black"): the dark CTA is the bright-ink pill, no longer parchment.
      refined["--cta"].toUpperCase() === refined["--ink"].toUpperCase(),
      "The dark CTA is the bright-ink pill",
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

    await page.locator('#themeSegments [data-value="light"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 });
    assert(await metaColor(page) === "#F4F2EF", "theme-color returns to cream", await metaColor(page));
    await checkContrast(page, "Light");

    await page.locator('#themeSegments [data-value="system"]').click();
    await page.waitForTimeout(100);
    assert(await storedTheme(page) === "system", "System is stored explicitly", await storedTheme(page));
    assert(await themeOf(page) === "light", "System resolves against the light device", await themeOf(page));
  } finally {
    await context.close();
  }
}

async function runPrePaint(browser) {
  console.log("\n4. The stored theme reaches the page before app.js");
  const context = await browser.newContext({ colorScheme: "light", serviceWorkers: "block" });
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
    // The exercise page owns the canvas chart (the overview carries none), and
    // draws it from a lift's second session: seed two in memory.
    await page.evaluate(() => {
      for (const [n, date, load] of [[1, "2026-09-09", 80], [2, "2026-09-16", 82.5]]) {
        state.log.push({
          session: `appearance-${n}`, date, created: `${date}T09:00:00.000Z`, day: "Day 1",
          name: "Barbell squat", exerciseId: "appearance-squat", set: 1, load, reps: 8, rir: 2, work: true,
          primary: "Quads", secondary: "Glutes", performedName: "Barbell squat", performedMovementId: "library:sq_bb",
        });
      }
      openExerciseView("library:sq_bb", "log");
    });
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.waitForFunction(() => {
      const c = document.querySelector("#exChart");
      return c && c.width > 0;
    }, { timeout: 5000 });

    const shot = () => page.evaluate(() => document.querySelector("#exChart").toDataURL());
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
    await page.locator('#themeSegments [data-value="dark"]').click();
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

    // A coach who hand-edits a theme into a setup document should not repaint
    // the recipient's app: the eight-setting allowlist has no room for it.
    const document = await buildSetupDocument(page);
    const validated = await page.evaluate((document) => {
      const compiler = window.RepForgeProgramCompiler;
      const options = {
        catalogSnapshot: window.RepForgeExerciseCatalog.snapshot(),
        validateProgramDefinition: compiler.validateProgramDefinition,
      };
      const api = window.RepForgeSharedSetup;
      const clean = api.validate(document, options);
      const themed = api.validate({ ...document, settings: { ...document.settings, theme: "dark" } }, options);
      return {
        cleanOk: clean.ok,
        cleanKeys: clean.ok ? Object.keys(clean.value.settings).sort() : clean.issues,
        themedOk: themed.ok,
        themedIssues: themed.issues || themed.code,
      };
    }, document);
    assert(validated.cleanOk && !validated.cleanKeys.includes("theme"),
      "The probe setup document is valid and carries no theme", JSON.stringify(validated));
    assert(
      validated.themedOk === false && validated.themedIssues.some((issue) => /settings\.theme/.test(issue)),
      "A setup link cannot carry a theme",
      JSON.stringify(validated.themedIssues)
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
      rowPadLeft: getComputedStyle(rows[1]).paddingLeft,
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
        // The rule starts where the row's label starts (the row's inline padding, --settings-inset: 0 since the
        // owner hill-climb put rows and captions on one edge with the page gutter, 2026-11-10).
        g.ruleLeft === g.rowPadLeft && g.ruleRight === "0px",
        `The rule between rows is held to the text column, not run edge to edge (${scheme})`,
        JSON.stringify({ left: g.ruleLeft, pad: g.rowPadLeft, right: g.ruleRight })
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

/** Mean RGB of a viewport strip, decoded from real pixels rather than declared styles. */
async function stripColor(page, clip) {
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
    return sum.map((v) => v / (d.length / 4));
  }, png);
}

async function runPaperFillsViewport(browser) {
  console.log("\n8. The paper fills the whole viewport when the page is shorter than it");
  // The installed app showed plain white under a short Today: the root is a size container, and containment stops
  // the body's background from reaching the canvas, so everything past the body's box was the default white.
  // Standalone has no browser chrome to hide it; the cause is the same in a tab, so a tab measures it.
  for (const theme of ["light", "dark"]) {
    const { context, page } = await freshPage(browser, "light");
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate((t) => window.__repforgeUi.setTheme(t), theme);
      await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
      const geo = await page.evaluate(() => ({
        bodyBottom: document.body.getBoundingClientRect().bottom,
        navTop: document.querySelector("nav").getBoundingClientRect().top,
        bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      }));
      assert(geo.bodyBottom < geo.navTop - 24, `${theme}: Today with no program ends above the dock`, JSON.stringify(geo));
      const y = Math.round((Math.max(geo.bodyBottom, 0) + geo.navTop) / 2);
      const seen = await stripColor(page, { x: 0, y, width: 390, height: 4 });
      const distance = colorDistance(seen, parseColor(geo.bg));
      assert(
        distance < 3,
        `${theme}: below the page, the viewport shows --bg`,
        `measured rgb(${seen.map((v) => v.toFixed(0)).join(",")}) at y=${y}; --bg ${geo.bg}`
      );
    } finally {
      await context.close();
    }
  }
}

async function runConcurrentPreferences(browser) {
  console.log("\nConcurrent device preferences under a held state-write lock");
  const context = await browser.newContext({ serviceWorkers: "block" });
  const a = await context.newPage(), b = await context.newPage();
  try {
    for (const page of [a, b]) {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForApp(page);
      await page.evaluate(() => window.__repforgeUi.flushPrefs?.());
    }
    await a.evaluate((key) => {
      const prefs = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...prefs, theme: "light", findingsSeen: ["existing"],
        collapsedProgramDays: ["Existing day"], installDismissedMilestone: 3, installDismissedAt: 12345,
        futurePreference: { keep: ["unknown", "record"] }, guideState: { ...prefs.guideState,
          entry: { version: 2, status: "completed", lastTransitionAt: 120 },
          "first-set": { version: 1, status: "deferred", lastTransitionAt: 121 },
          futureGuide: { version: 9, status: "dismissed", lastTransitionAt: 123 } } }));
    }, UIKEY);
    for (const page of [a, b]) { await page.reload(); await waitForApp(page); await page.evaluate(() => window.__repforgeUi.flushPrefs?.()); }
    const read = () => a.evaluate(key => JSON.parse(localStorage.getItem(key)), UIKEY);
    const nested = await a.evaluate(async () => {
      const durable = window.RepForgeDurableState;
      return durable.withStorageLock(durable.storageIO, () => {
        window.__nestedPrefWrite = window.__repforgeUi.setPref("weekCardSeen", "nested-lock");
        return JSON.parse(localStorage.getItem("repforge_ui_v1")).weekCardSeen;
      });
    });
    assert(nested === "nested-lock", "a preference merges immediately inside an already-owned storage lock", nested);
    await a.evaluate(() => window.__nestedPrefWrite);
    const ordered = await a.evaluate(async () => {
      const durable = window.RepForgeDurableState;
      let older, newer, owner;
      await navigator.locks.request("repforge:state-write", () => {
        owner = durable.withStorageLock(durable.storageIO, () => {
          newer = window.__repforgeUi.setPref("theme", "light");
        });
        older = window.__repforgeUi.setPref("theme", "dark");
      });
      await owner; await older; await newer;
      return JSON.parse(localStorage.getItem("repforge_ui_v1")).theme;
    });
    assert(ordered === "light", "a newer write inside an owned lock cannot be undone by an older queued preference", ordered);
    const cases = [
      { label: "theme and collapsed days", first: ["setTheme", "dark"], second: ["setPref", "collapsedProgramDays", ["Other day"]], changes: { theme: "dark", collapsedProgramDays: ["Other day"] } },
      { label: "findings and theme", first: ["setPref", "findingsSeen", ["existing", "new"]], second: ["setPref", "theme", "system"], changes: { findingsSeen: ["existing", "new"], theme: "system" } },
      { label: "same key, last request wins", first: ["setPref", "theme", "dark"], second: ["setPref", "theme", "light"], changes: { theme: "light" } },
      { label: "two guide records", first: ["replayGuide", "progress"], second: ["replayGuide", "block-transition"], changes: {}, guideIds: ["progress", "block-transition"] },
    ];
    for (const test of cases) {
      const before = await read();
      await a.evaluate(() => {
        window.__prefLockHeld = false;
        const gate = new Promise(resolve => { window.__releasePrefLock = resolve; });
        window.__prefLock = navigator.locks.request("repforge:state-write", async () => {
          window.__prefLockHeld = true; await gate;
        });
      });
      await a.waitForFunction(() => window.__prefLockHeld);
      try {
        for (const [page, operation] of [[a, test.first], [b, test.second]]) {
          await page.evaluate(([method, ...args]) => {
            window.__prefSettled = false;
            window.__prefResult = Promise.resolve(window.__repforgeUi[method](...args)).then(async result => {
              await window.__repforgeUi.flushPrefs();
              window.__prefSettled = true; return result;
            });
          }, operation);
        }
        if (test.first[0] === "setTheme") assert(await themeOf(a) === "dark", "Appearance paints immediately while persistence is held");
        const held = await read();
        const settled = await Promise.all([a, b].map(page => page.evaluate(() => window.__prefSettled)));
        assert(JSON.stringify(held) === JSON.stringify(before) && settled.every(value => !value),
          `${test.label}: canonical merges wait for the held cross-tab lock`, JSON.stringify({ held, settled }));
      } finally {
        await a.evaluate(async () => { window.__releasePrefLock(); await window.__prefLock; });
      }
      const outcomes = await Promise.all([a, b].map(page => page.evaluate(() => window.__prefResult)));
      await Promise.all([a, b].map(page => page.evaluate(() => window.__repforgeUi.flushPrefs?.())));
      const after = await read();
      assert(outcomes.every(value => value === true), `${test.label}: both writes acknowledge persistence`, outcomes);
      assert(Object.entries(test.changes).every(([key, value]) => JSON.stringify(after[key]) === JSON.stringify(value)),
        `${test.label}: both changes survive, with last-write-wins on the same key`, JSON.stringify(after));
      const kept = Object.entries(before).every(([key, value]) => key in test.changes || test.guideIds && key === "guideState" || JSON.stringify(after[key]) === JSON.stringify(value));
      const guidesKept = Object.entries(before.guideState).every(([id, value]) => test.guideIds?.includes(id) || JSON.stringify(after.guideState[id]) === JSON.stringify(value));
      assert(kept && guidesKept && (!test.guideIds || test.guideIds.every(id => after.guideState[id].status === "deferred" && Number.isFinite(after.guideState[id].lastTransitionAt))),
        `${test.label}: every other preference and guide record is retained`, JSON.stringify({ before, after }));
      for (const page of [a, b]) { await page.reload(); await waitForApp(page); await page.evaluate(() => window.__repforgeUi.flushPrefs?.()); }
      assert(JSON.stringify(await read()) === JSON.stringify(after), `${test.label}: the entire preference record survives reload`);
    }
    const holder = await context.newPage();
    await holder.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(holder);
    await holder.evaluate(() => {
      const gate = new Promise(resolve => { window.__releaseReloadLock = resolve; });
      window.__reloadLockHeld = false;
      window.__reloadLock = navigator.locks.request("repforge:state-write", async () => {
        window.__reloadLockHeld = true; await gate;
      });
    });
    await holder.waitForFunction(() => window.__reloadLockHeld);
    const beforeReload = await read();
    try {
      await a.evaluate(() => { void window.__repforgeUi.setPref("theme", "dark"); });
      await b.evaluate(() => { void window.__repforgeUi.setPref("weekCardSeen", "reload-before-merge"); });
      for (const page of [a, b]) await page.reload({ waitUntil: "domcontentloaded" });
    } finally {
      await holder.evaluate(async () => { window.__releaseReloadLock(); await window.__reloadLock; });
    }
    for (const page of [a, b]) await waitForApp(page);
    const reloaded = await read();
    assert(reloaded.theme === "dark" && reloaded.weekCardSeen === "reload-before-merge",
      "both tabs' different preference keys survive immediate reload before either locked merge runs", reloaded);
    assert(Object.entries(beforeReload).every(([key, value]) => ["theme", "weekCardSeen"].includes(key) || JSON.stringify(value) === JSON.stringify(reloaded[key])),
      "immediate reload retains every untouched preference and guide record", reloaded);
  } finally { await context.close(); }
}

async function runPreferencesWithoutLocks(browser) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  const a = await context.newPage(), b = await context.newPage();
  try {
    for (const page of [a, b]) { await page.goto(BASE); await waitForApp(page); }
    await Promise.all([
      a.evaluate(() => window.__repforgeUi.setPref("theme", "dark")),
      b.evaluate(() => window.__repforgeUi.setPref("weekCardSeen", "without-locks")),
    ]);
    assert(await a.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
      "without a cross-tab lock, durable intents remain available instead of unsafe compaction");
    for (const page of [a, b]) { await page.reload(); await waitForApp(page); }
    const prefs = await a.evaluate(() => window.__repforgeUi.loadUiPrefs());
    assert(prefs.theme === "dark" && prefs.weekCardSeen === "without-locks",
      "different tabs' preferences also survive reload when Web Locks are unavailable", prefs);
  } finally { await context.close(); }
}

async function runPreferenceJournalLifecycle(browser) {
  console.log("\nPreference journal clear, quota and bounded failure recovery");
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage(), holder = await context.newPage();
  try {
    for (const tab of [page, holder]) { await tab.goto(BASE); await waitForApp(tab); await tab.evaluate(() => window.__repforgeUi.flushPrefs()); }
    await holder.evaluate(() => {
      const gate = new Promise(resolve => { window.__releaseClearLock = resolve; });
      window.__clearLock = navigator.locks.request("repforge:state-write", async () => {
        window.__clearLockHeld = true; await gate;
      });
    });
    await holder.waitForFunction(() => window.__clearLockHeld);
    try {
      await page.evaluate(() => { void window.__repforgeUi.setPref("theme", "dark"); });
      assert(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
        "a preference intent is durable while consolidation is held before a full device clear");
      // Browser site-data deletion is the full device reset. Settings' Delete
      // workout history intentionally retains preferences and is not this path.
      const storage = await context.newCDPSession(page);
      await storage.send("Storage.clearDataForOrigin", { origin: new URL(BASE).origin, storageTypes: "all" });
      await storage.detach();
      await page.reload({ waitUntil: "domcontentloaded" });
    } finally {
      await holder.evaluate(async () => { window.__releaseClearLock(); await window.__clearLock; });
    }
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeUi.flushPrefs());
    assert(await page.evaluate(() => window.__repforgeUi.loadUiPrefs().theme === undefined),
      "full device clear followed by immediate reload never resurrects the pending preference");
    assert(await page.evaluate(() => !Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
      "successful consolidation removes all acknowledged journal entries after clear");

    const quota = await page.evaluate(async () => {
      const before = window.__repforgeUi.loadUiPrefs();
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (String(key).startsWith("repforge_ui_v1:pending:")) throw new DOMException("proof quota", "QuotaExceededError");
        return write.call(this, key, value);
      };
      let result;
      try { result = await window.__repforgeUi.setPref("theme", "dark"); }
      finally { Storage.prototype.setItem = write; }
      return { result, before, after: window.__repforgeUi.loadUiPrefs() };
    });
    assert(quota.result === false && JSON.stringify(quota.before) === JSON.stringify(quota.after),
      "quota failure rejects the change without claiming durability or changing preferences", quota);
  } finally { await context.close(); }

  const blocked = await browser.newContext({ serviceWorkers: "block" });
  await blocked.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "repforge_ui_v1" && !window.__allowPrefBaseWrites) throw new DOMException("held canonical write", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  const failing = await blocked.newPage();
  try {
    await failing.goto(BASE); await waitForApp(failing);
    const oversized = await failing.evaluate(async () => {
      const before = JSON.stringify(window.__repforgeUi.loadUiPrefs());
      const result = await window.__repforgeUi.setPref("largeProof", "x".repeat(256 * 1024));
      return { result, unchanged: before === JSON.stringify(window.__repforgeUi.loadUiPrefs()) };
    });
    assert(oversized.result === false && oversized.unchanged,
      "an oversized intent is refused without bypassing the journal byte budget", oversized);
    const observed = await failing.evaluate(async () => {
      let rejected = 0, accepted = 0;
      for (let i = 0; i < 160; i++) {
        const previous = window.__repforgeUi.loadUiPrefs().weekCardSeen;
        await window.__repforgeUi.setPref("weekCardSeen", String(i));
        if (window.__repforgeUi.loadUiPrefs().weekCardSeen === String(i)) accepted++;
        else { rejected++; if (window.__repforgeUi.loadUiPrefs().weekCardSeen !== previous) throw new Error("rejected change mutated prefs"); }
      }
      const keys = Object.keys(localStorage).filter(key => key.startsWith("repforge_ui_v1:pending:"));
      return { accepted, rejected, count: keys.length, latest: window.__repforgeUi.loadUiPrefs().weekCardSeen };
    });
    assert(observed.count <= 128 && observed.accepted > 0 && observed.rejected > 0,
      "persistent consolidation failure bounds the journal and rejects further changes without discarding acknowledged intents", JSON.stringify(observed));
    await failing.reload(); await waitForApp(failing);
    assert(await failing.evaluate(() => window.__repforgeUi.loadUiPrefs().weekCardSeen) === observed.latest,
      "the last durably accepted change survives reload even when consolidation keeps failing");
    const recovered = await failing.evaluate(async () => {
      window.__allowPrefBaseWrites = true;
      await window.__repforgeUi.setPref("weekCardSeen", "retry-after-full");
      await window.__repforgeUi.flushPrefs();
      const accepted = await window.__repforgeUi.setPref("weekCardSeen", "recovered");
      return { accepted, value: window.__repforgeUi.loadUiPrefs().weekCardSeen,
        pending: Object.keys(localStorage).filter(key => key.startsWith("repforge_ui_v1:pending:")).length };
    });
    assert(recovered.accepted === true && recovered.value === "recovered" && recovered.pending === 0,
      "a full journal retries cleanup and accepts new changes when consolidation recovers", JSON.stringify(recovered));
  } finally { await blocked.close(); }
}

async function runPendingPreferenceExport(browser) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(BASE); await waitForApp(page); await page.evaluate(() => window.__repforgeUi.flushPrefs());
    await page.evaluate(async () => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "repforge_ui_v1") throw new DOMException("held export consolidation", "QuotaExceededError");
        return write.call(this, key, value);
      };
      try { await window.__repforgeUi.setPref("theme", "dark"); }
      finally { Storage.prototype.setItem = write; }
    });
    assert(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
      "export fixture has an acknowledged intent not yet consolidated into the base record");
    // Ordinary backups exclude device preferences, including pending ones.
    const [download] = await Promise.all([page.waitForEvent("download"),
      page.evaluate(() => document.querySelector("#exportJson").click())]);
    const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
    assert(!("uiPreferences" in backup) && !("theme" in backup.settings) && !JSON.stringify(backup).includes("repforge_ui_v1"),
      "ordinary backup keeps pending device preferences and journal metadata out of training data");
    const exported = await page.evaluate(async () => {
      const result = await window.installTransferCaptureLogicalSnapshot();
      return { result, base: JSON.parse(localStorage.getItem("repforge_ui_v1")),
        pending: Object.keys(localStorage).filter(key => key.startsWith("repforge_ui_v1:pending:")) };
    });
    assert(exported.result.ok && exported.result.value.uiPreferences.theme === "dark",
      "the production install-transfer producer includes not-yet-consolidated preferences", JSON.stringify(exported));
    assert(exported.base.theme === "dark" && exported.pending.length === 0,
      "install-transfer export consolidates preferences before capturing them", JSON.stringify(exported));
    await page.evaluate(async () => {
      const write = Storage.prototype.setItem;
      window.__restoreBackupPreferenceWrites = () => { Storage.prototype.setItem = write; };
      Storage.prototype.setItem = function(key, value) {
        if (key === "repforge_ui_v1") throw new DOMException("held backup preference merge", "QuotaExceededError");
        return write.call(this, key, value);
      };
      await window.__repforgeUi.setPref("theme", "light");
    });
    await page.locator("#importJson").setInputFiles({ name: "pending-preference-backup.json",
      mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.locator("#importChoice[open]").waitFor();
    await page.locator("#importReplace").click();
    await page.waitForFunction(() => !document.querySelector("#importChoice").open);
    assert(await page.evaluate(() => window.__repforgeUi.loadUiPrefs().theme === "light" &&
      Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
      "ordinary backup replacement preserves this device's pending preference instead of copying source appearance");
    await page.evaluate(() => window.__restoreBackupPreferenceWrites());
    await page.reload(); await waitForApp(page);
    assert(await themeOf(page) === "light", "pending device preferences survive backup replacement and reload");
  } finally { await context.close(); }
}

async function runPreferenceJournalVersionSkew(browser) {
  const old = legacyRelease("2b200fdd2a916405ce6e77932053f9f0edbd162c");
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage(), holder = await context.newPage();
  try {
    for (const tab of [page, holder]) { await tab.goto(BASE); await waitForApp(tab); await tab.evaluate(() => window.__repforgeUi.flushPrefs()); }
    await page.evaluate(() => window.__repforgeUi.setPref("theme", "light"));
    await holder.evaluate(() => {
      const gate = new Promise(resolve => { window.__releaseLegacyLock = resolve; });
      window.__legacyLock = navigator.locks.request("repforge:state-write", async () => {
        window.__legacyLockHeld = true; await gate;
      });
    });
    await holder.waitForFunction(() => window.__legacyLockHeld);
    await page.evaluate(() => { void window.__repforgeUi.setPref("theme", "dark"); });
    const pending = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
      .filter(key => key.startsWith("repforge_ui_v1:pending:")).map(key => [key, localStorage.getItem(key)])));
    const types = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json" };
    const serveOld = async route => {
      const url = new URL(route.request().url()), base = new URL(BASE);
      const path = url.pathname.slice(base.pathname.length) || "index.html";
      const type = types[path.split(".").at(-1)];
      if (url.origin !== base.origin || !type) return route.continue();
      const body = old.file(path);
      if (body) await route.fulfill({ body, contentType: type });
      else await route.continue();
    };
    await page.route("**/*", serveOld);
    try { await page.reload({ waitUntil: "domcontentloaded" }); }
    finally { await holder.evaluate(async () => { window.__releaseLegacyLock(); await window.__legacyLock; }); }
    await waitForApp(page);
    assert(await themeOf(page) === "light", "the real journal-unaware release boots against its own shell using the valid base preference fallback");
    assert(await page.evaluate(records => Object.entries(records).every(([key, raw]) => localStorage.getItem(key) === raw), pending),
      "the older release leaves every pending intent intact");
    await page.unroute("**/*", serveOld);
    await page.reload(); await waitForApp(page); await page.evaluate(() => window.__repforgeUi.flushPrefs());
    assert(await themeOf(page) === "dark", "the next new-release load applies the pending change ignored by the older release");
    assert(await page.evaluate(() => !Object.keys(localStorage).some(key => key.startsWith("repforge_ui_v1:pending:"))),
      "the new release consolidates and cleans the old retained intent");
    assert(old.onDemand.length === 0, "the older shell and modules were preloaded from one retained release", old.onDemand);
  } finally { await context.close(); }
}

async function main() {
  console.log("Appearance / dark theme");
  console.log(`Target: ${BASE}`);
  runPaletteIsTheOnlyPlace();
  const browser = await launchChromium();
  try {
    if (process.env.APPEARANCE_ONLY !== "journal") {
      await runConcurrentPreferences(browser);
      await runPreferencesWithoutLocks(browser);
    }
    await runPreferenceJournalLifecycle(browser);
    await runPendingPreferenceExport(browser);
    await runPreferenceJournalVersionSkew(browser);
    if (!["preferences", "journal"].includes(process.env.APPEARANCE_ONLY)) {
    await runLightDefault(browser);
    await runFollowsSystemLive(browser);
    await runSettingsRow(browser);
    await runPrePaint(browser);
    await runChartRepaint(browser);
    await runStaysOutOfTrainingData(browser);
    await runSettingsReadsAsOneList(browser);
    await runPaperFillsViewport(browser);
    }
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
