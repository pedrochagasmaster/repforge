#!/usr/bin/env node
/**
 * The app shell's chrome on the owner's phone (2026-10-18), at 390×844 with the shipped 44/34 safe areas:
 *
 * 1. Nothing scrolls into the status bar. Installed, the page runs under the iOS status bar, so the top inset is
 *    painted with the page's own paper and stays above whatever scrolls. Chromium has no status bar to draw, so the
 *    proof reads the pixels: the inset band is one uniform --bg colour at every scroll position, on every tab and in
 *    the Program editor, in the light and the dark theme.
 * 2. The floating rest pill never leaves content under it. On every tab, scrolled to the end, no control sits under
 *    the pill, and Today's sticky Start/Continue never rides under it at any scroll position.
 * 3. Today's prescription keeps a long exercise name readable: the longest catalog name wraps at word boundaries
 *    only, with no line shorter than three characters, at 390 and 375 px. A manual row's target is sets × range
 *    (owner copy 2026-10-18), and the subtitle counts "exercises with your own targets".
 * 4. The onboarding layer (#onboarding) scrolls on its own above the shell, so it paints its own paper band over the
 *    top inset: on the review result and the Build editor, the band is solid --bg at scroll 0, mid and end (#449).
 * 5. The first-run landing (.firstrun) scrolls on its own too, over night, ink, orange and paper sections, so its band
 *    takes the ground of whichever section is under the inset (owner call on #449): one solid colour, that section's.
 */
import { launchChromium } from "./browser.mjs";
import { SAFE_AREA, openCatalogState } from "./fixtures/catalog-state.mjs";
import { seedProgramMeta } from "./fixtures/seed-program.mjs";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}

const SURFACES = ["log", "stats", "history", "program", "editor"];

async function openSurface(page, surface) {
  if (surface === "editor") {
    await page.click("#programEditToggle");
    await page.waitForSelector('#programEditor [data-role="editor"]', { timeout: 20000 });
  } else {
    await page.click(`nav [data-view="${surface}"]`);
    await page.waitForFunction((name) => document.querySelector(`nav [data-view="${name}"]`)?.classList.contains("active"), surface);
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function scrollTo(page, y) {
  await page.evaluate((top) => {
    window.scrollTo({ top: top === "end" ? document.documentElement.scrollHeight : top, behavior: "instant" });
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, y);
}

const scrollMax = (page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

/** Pixels in the top inset band that are not the page's --bg, out of the band's total. */
async function bandReading(page) {
  const width = page.viewportSize().width;
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width, height: SAFE_AREA.top }, animations: "disabled" });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const probe = document.createElement("div");
    probe.style.background = "var(--bg)";
    document.body.append(probe);
    ctx.fillStyle = getComputedStyle(probe).backgroundColor;
    probe.remove();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let off = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) > 3 || Math.abs(data[i + 1] - g) > 3 || Math.abs(data[i + 2] - b) > 3) off++;
    }
    return { off, total: data.length / 4, bg: [r, g, b] };
  }, shot.toString("base64"));
}

/** Pixels in the top inset band that are not `rgb`, out of the band's total. */
async function bandAgainst(page, rgb) {
  const width = page.viewportSize().width;
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width, height: SAFE_AREA.top }, animations: "disabled" });
  return page.evaluate(async ({ b64, rgb: [r, g, b] }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let off = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) > 3 || Math.abs(data[i + 1] - g) > 3 || Math.abs(data[i + 2] - b) > 3) off++;
    }
    return { off, total: data.length / 4, ground: [r, g, b] };
  }, { b64: shot.toString("base64"), rgb });
}

/** Controls in the page that the rest pill covers, and the pill's own box. */
const underPill = (page) => page.evaluate(() => {
  const pill = document.querySelector("#restBar");
  const box = pill?.getBoundingClientRect();
  if (!box || box.width < 1 || getComputedStyle(pill).display === "none") return { error: "the rest pill is not showing" };
  const hits = [];
  for (const el of document.querySelectorAll("main :is(button,a[href],input,select,textarea,summary,[role=button],[role=switch],[tabindex]:not([tabindex='-1']))")) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.left < box.right - 0.5 && r.right > box.left + 0.5 && r.top < box.bottom - 0.5 && r.bottom > box.top + 0.5) {
      hits.push(`${el.id ? `#${el.id}` : el.className || el.tagName} "${(el.textContent || el.value || "").trim().slice(0, 24)}"`);
    }
  }
  return { pill: { top: box.top, bottom: box.bottom, left: box.left, right: box.right }, hits, scroll: scrollY };
});

const browser = await launchChromium();
try {
  console.log("\n1. Nothing scrolls into the status bar, and 2. the rest pill leaves nothing under it (390×844)");
  for (const theme of ["light", "dark"]) {
    const { context, page } = await openCatalogState(browser, "today/rest-bar", 390, "en", "normal", { theme });
    try {
      for (const surface of SURFACES) {
        await openSurface(page, surface);
        const max = await scrollMax(page);
        check(max > SAFE_AREA.top, `${theme} ${surface}: the page is long enough to scroll under the status bar`, { max });
        const dirty = [];
        for (const y of [0, Math.round(max / 3), Math.round((2 * max) / 3), "end"]) {
          await scrollTo(page, y);
          const band = await bandReading(page);
          if (band.off) dirty.push({ y, ...band });
        }
        check(!dirty.length, `${theme} ${surface}: the status-bar inset is solid paper at every scroll position`, dirty);

        if (theme !== "light") continue;
        await scrollTo(page, "end");
        const end = await underPill(page);
        check(!end.error && !end.hits.length, `${surface}: scrolled to the end, no control is left under the rest pill`, end);
        if (surface === "log") {
          const covered = [];
          for (let y = 0; y <= max; y += 60) {
            await scrollTo(page, y);
            const now = await page.evaluate(() => {
              const cta = document.querySelector("#startWorkout")?.getBoundingClientRect();
              const pill = document.querySelector("#restBar")?.getBoundingClientRect();
              return cta && pill && cta.width > 0 && cta.bottom > pill.top + 0.5 && cta.top < pill.bottom - 0.5
                && cta.right > pill.left + 0.5 ? { cta: cta.bottom, pill: pill.top, y: scrollY } : null;
            });
            if (now) covered.push(now);
          }
          check(!covered.length, "Today: Continue never rides under the rest pill while it floats", covered.slice(0, 3));
        }
      }
    } finally { await context.close(); }
  }

  console.log("\n3. Today keeps a long exercise name readable");
  for (const lang of ["en", "pt"]) {
    // A fresh device sets up the seed Build program (manual rows, sets × range) with the first slot of every day
    // swapped for the catalog movement with the longest name that logs the same load and reps.
    const { context, page } = await openCatalogState(browser, "today/no-program", 390, lang, "normal");
    try {
      const named = await page.evaluate(async (definition) => {
        const catalog = window.RepForgeExerciseCatalog.snapshot();
        const metricIds = definition.days[0].slots[0].metricIds.join();
        const source = catalog.exercises.filter((entry) => (entry.exerciseMetrics || []).join() === metricIds)
          .reduce((a, b) => (String(b.name).length > String(a.name).length ? b : a));
        for (const day of definition.days) {
          const slot = day.slots[0];
          if (!slot) continue;
          Object.assign(slot, {
            exerciseId: source.id, sourceExerciseIds: [source.id], exerciseTypeId: source.exerciseType, displayName: source.name,
            musclePurposeIds: [...source.primaryFeatureMuscle], movementPatternIds: [...source.movementPattern],
            loadingModel: { ...slot.loadingModel, bodyweightCoefficient: source.bodyweight },
          });
        }
        const valid = window.RepForgeProgramCompiler.validateProgramDefinition(definition, catalog, []);
        if (!valid.ok) return { error: `the long-name program is invalid: ${JSON.stringify(valid.issues).slice(0, 400)}` };
        await window.__repforgeFinalizeProgramSetup({
          programDefinition: definition, name: "Long names", answers: {}, destination: "log", origin: "first-run",
          draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "long-names" },
        });
        await window.__repforgeStorage.flush();
        const row = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program?.find((entry) => entry.libraryId === source.id);
        return row ? { id: row.id, name: source.name } : { error: "the long-name program was not set up" };
      }, seedProgramMeta({}).programDefinition);
      if (named.error) { check(false, named.error); continue; }
      await openSurface(page, "log");
      for (const width of [390, 375]) {
        await page.setViewportSize({ width, height: 844 });
        const row = page.locator(`#todayExList .rxrow[data-exopen="${named.id}"]`);
        await row.waitFor({ state: "visible", timeout: 20000 });
        const lines = await row.evaluate((button) => {
          const name = button.querySelector(".rxrow__name");
          const text = name.firstChild;
          const chars = [];
          for (let i = 0; i < text.length; i++) {
            const range = document.createRange();
            range.setStart(text, i); range.setEnd(text, i + 1);
            const rect = range.getBoundingClientRect();
            chars.push({ ch: text.data[i], top: Math.round(rect.top) });
          }
          const out = [];
          let breaks = [];
          for (let i = 0; i < chars.length; i++) {
            if (!out.length || chars[i].top !== chars[i - 1].top) {
              if (out.length) breaks.push(`${chars[i - 1].ch}|${chars[i].ch}`);
              out.push("");
            }
            out[out.length - 1] += chars[i].ch;
          }
          const midWord = breaks.filter((pair) => !/^[\s\-/]\||\|\s/.test(pair));
          return { text: text.data, lines: out.map((line) => line.trim()), midWord, target: button.querySelector(".rxrow__target")?.textContent.replace(/\s+/g, " ").trim() };
        });
        check(lines.text && !lines.midWord.length && lines.lines.every((line) => line.length >= 3),
          `${lang} ${width}px: "${lines.text}" wraps at word boundaries (${lines.lines.join(" / ")}), every line at least three characters`, lines);
        check(/^\d+ × \d+–\d+$/.test(lines.target), `${lang} ${width}px: the manual target reads sets × range and nothing else`, lines.target);
      }
      const tally = await page.evaluate(() => [...document.querySelectorAll("#todayDash .today-tally__i")].map((li) => li.textContent.trim()));
      const owner = lang === "en" ? /^(1 exercise|\d+ exercises) with your own targets$/ : /^(1 exercício|\d+ exercícios) com metas suas$/;
      check(tally.some((line) => owner.test(line)), `${lang}: the subtitle counts the exercises with your own targets`, tally);
    } finally { await context.close(); }
  }

  console.log("\n4. Onboarding scrolls in its own layer, and nothing in it scrolls into the status bar (390×844)");
  for (const theme of ["light", "dark"]) {
    for (const key of ["onboarding-recommend/result-changed", "onboarding-build/editor-ready"]) {
      const { context, page } = await openCatalogState(browser, key, 390, "en", "normal", { theme });
      try {
        const max = await page.evaluate(() => { const layer = document.querySelector("#onboarding"); return layer.scrollHeight - layer.clientHeight; });
        check(max > SAFE_AREA.top, `${theme} ${key}: the onboarding layer is long enough to scroll under the status bar`, { max });
        const dirty = [];
        for (const y of [0, Math.round(max / 2), "end"]) {
          await page.evaluate((top) => {
            const layer = document.querySelector("#onboarding");
            layer.scrollTo({ top: top === "end" ? layer.scrollHeight : top, behavior: "instant" });
            return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }, y);
          const band = await bandReading(page);
          if (band.off) dirty.push({ y, ...band });
        }
        check(!dirty.length, `${theme} ${key}: the status-bar inset is solid paper at scroll 0, mid and end`, dirty);
      } finally { await context.close(); }
    }
  }

  console.log("\n5. The first-run landing's status-bar band takes the ground of the section under it (390×844)");
  for (const theme of ["light", "dark"]) {
    const { context, page } = await openCatalogState(browser, "onboarding-start/first-run", 390, "en", "normal", { theme });
    try {
      const { max, hero } = await page.evaluate(() => {
        const layer = document.querySelector(".firstrun");
        return { max: layer.scrollHeight - layer.clientHeight, hero: document.querySelector(".firstrun-hero").getBoundingClientRect().height };
      });
      const dirty = [];
      for (const [stop, y] of [["top", 0], ["hero leaving", Math.round(hero - 120)], ["mid", Math.round(max / 2)], ["end", "end"]]) {
        const ground = await page.evaluate((top) => {
          const layer = document.querySelector(".firstrun");
          layer.scrollTo({ top: top === "end" ? layer.scrollHeight : top, behavior: "instant" });
          return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
            // The section whose box covers the top of the inset; the band itself is never hit-tested.
            const section = [...layer.querySelectorAll(".firstrun-band")].find((band) => {
              const box = band.getBoundingClientRect();
              return box.top <= 0 && box.bottom > 0;
            });
            const rgb = section && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(section).backgroundColor);
            resolve(rgb ? { section: section.dataset.landingSection, rgb: rgb.slice(1, 4).map(Number) } : null);
          })));
        }, y);
        if (!ground) { dirty.push({ stop, error: "no section under the inset" }); continue; }
        const band = await bandAgainst(page, ground.rgb);
        if (band.off) dirty.push({ stop, section: ground.section, ...band });
      }
      check(!dirty.length, `${theme} first-run: at the top, as the hero leaves, mid and end, the inset is one solid band in the ground of the section under it`, dirty);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
