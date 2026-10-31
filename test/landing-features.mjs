#!/usr/bin/env node
/**
 * The landing's feature tabs (owner, 2026-10-30): five scenes built from the app's own strings and markup.
 *
 * Part 1, Node only (app.js and the two catalogs):
 *   1. every key in LANDING_FEATURE_KEYS exists, non-empty, in both catalogs;
 *   2. every literal key the scenes' code passes to t() is on that list, and every data-i18n key the section's markup
 *      names is too (the list is complete);
 *   3. the library tab states the library's real size: its copy is a {count} template and carries no typed number.
 * Part 2, browser (REPFORGE_URL):
 *   4. across sampled frames of every scene, in EN and PT, no text in the section reads NaN, undefined, null,
 *      Infinity or an unfilled {placeholder}, and every transform and opacity the frames write is finite;
 *   5. the same holds when the platform hands requestAnimationFrame a missing timestamp and performance.now() returns
 *      NaN (what broke the proof on iOS Safari): the tabs keep playing on their own frame deltas;
 *   6. the player runs only while the panel is on screen, a tab tap jumps to its scene, and under reduced motion
 *      nothing plays and each tab is a still.
 *
 * Run: node test/landing-features.mjs   (with a static server on REPFORGE_URL)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const catalogs = Object.fromEntries(["en", "pt"].map((lang) =>
  [lang, JSON.parse(readFileSync(new URL(`../i18n-${lang}.json`, import.meta.url), "utf8"))]));
const { EXERCISE_LIBRARY } = await import(new URL("../exercises.js", import.meta.url)).then((m) => m.default || m);
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); } catch (error) { failed++; console.error(`  ✗ ${name}\n    ${error.message}`); }
}
const between = (from, to) => {
  const start = app.indexOf(from), end = app.indexOf(to, start);
  return start >= 0 && end > start ? app.slice(start, end) : "";
};

// ---- Part 1 ----------------------------------------------------------------
const listSource = between("const LANDING_FEATURE_MUSCLES=", "/** The scene at `time` seconds");
const KEYS = listSource ? new Function(`${listSource};return LANDING_FEATURE_KEYS;`)() : [];
const sceneCode = between("function landingFeatureCopy(root){", "/** Where a node's centre is");
const section = (() => {
  const start = index.indexOf('data-landing-section="features"'), end = index.indexOf("</section>", start);
  return start >= 0 && end > start ? index.slice(start, end) : "";
})();

await check("the key list and the scenes' code are found", () => {
  assert(KEYS.length > 60, `LANDING_FEATURE_KEYS has ${KEYS.length} keys`);
  assert(sceneCode.includes("function landingFeatureScreens()"), "the scene builder is in app.js");
  assert(section.includes("data-feature-screen"), "the features section is in index.html");
});
await check("every listed key exists, non-empty, in both catalogs", () => {
  for (const lang of ["en", "pt"]) {
    const missing = KEYS.filter((key) => typeof catalogs[lang][key] !== "string" || !catalogs[lang][key].trim());
    assert.deepEqual(missing, [], `[${lang}] missing or empty`);
  }
});
await check("every literal key the scenes say, and every key the section's markup names, is on the list", () => {
  const said = [...sceneCode.matchAll(/\bt\("([\w.\- ]+)"/g)].map((m) => m[1]);
  const marked = [...section.matchAll(/data-(?:i18n|feature-fill)="([\w.\- ]+)"/g)].map((m) => m[1]);
  assert(said.length > 30 && marked.length >= 16, `found ${said.length} said and ${marked.length} marked`);
  // A key built from a prefix (`picker.tab.${tab}`) is covered when the list holds keys under that prefix.
  const missing = [...new Set([...said, ...marked])].filter((key) => key.endsWith(".") ? !KEYS.some((listed) => listed.startsWith(key)) : !KEYS.includes(key));
  assert.deepEqual(missing, []);
});
await check("the library tab states the library's real size through {count}, never a typed number", () => {
  for (const lang of ["en", "pt"]) for (const key of ["landing.features.library.title", "landing.features.library.text"]) {
    const copy = catalogs[lang][key];
    assert(copy.includes("{count}") && !/\d/.test(copy.replace("{count}", "")), `[${lang}] ${key}: ${copy}`);
  }
  assert(/landingFeatureCount=\(\)=>Math\.floor\(EXERCISE_LIBRARY\.length\/100\)\*100/.test(app), "the count is the library's length, floored to the hundred");
  assert(EXERCISE_LIBRARY.length >= 1300, `the library holds ${EXERCISE_LIBRARY.length}`);
});

// ---- Part 2 ----------------------------------------------------------------
const SCENES = (() => {
  const match = /scenes:(\[\{len:[^\]]+\])/.exec(app);
  return match ? new Function(`return ${match[1]}`)() : [];
})();
/** Each scene's camera shots, as app.js lists them. */
const SHOTS = (() => {
  const match = /shots:(\[\s*\[\{at:[\s\S]*?\][,\s]*\])\[i\]/.exec(app);
  return match ? new Function(`return ${match[1]}`)() : [];
})();

async function landing(browser, { lang = "en", reducedMotion = "no-preference", hostileClock = false, width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: lang === "pt" ? "pt-BR" : "en-US", reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  if (hostileClock) await page.addInitScript(() => {
    // The platform gives no usable clock: a frame callback without a timestamp and a performance.now() of NaN.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf(() => fn(undefined));
    performance.now = () => NaN;
  });
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  if (!(await page.locator("#firstRun:not(.hidden)").count())) await page.evaluate(() => window.openFirstRun());
  await page.waitForSelector('#firstRun:not(.hidden) [data-landing-section="features"] [data-feature-screen] .firstrun-fx', { timeout: 20000 });
  if (lang === "pt" && (await page.evaluate(() => window.I18N?.getLang?.())) !== "pt") await page.evaluate(() => window.I18N?.setLang?.("pt"));
  return { context, page, errors };
}
/** Runs in the page: every text the section shows and every transform/opacity its frames wrote that is not a number. */
function readBad() {
  const root = document.querySelector('[data-landing-section="features"]');
  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) texts.push(walker.currentNode.nodeValue);
  const badText = texts.filter((value) => /NaN|undefined|null|Infinity|\{\w+\}/.test(value));
  const badStyle = [...root.querySelectorAll("[style]")].flatMap((node) =>
    ["transform", "opacity", "--feature-progress"].map((prop) => node.style.getPropertyValue(prop)).filter((value) => /NaN|Infinity|undefined/.test(value)));
  return { badText, badStyle };
}
const scrollToPanel = (page) => page.evaluate(() => {
  const root = document.querySelector("#firstRun"), panel = document.querySelector("#firstRunFeatPanel");
  root.scrollTop += panel.getBoundingClientRect().top - 40;
});

const browser = await launchChromium();
try {
  for (const lang of ["en", "pt"]) {
    await check(`[${lang}] sampled frames of all five scenes show only finite numbers and filled text`, async () => {
      const { context, page, errors } = await landing(browser, { lang });
      await scrollToPanel(page);
      const bad = [];
      for (let i = 0; i < SCENES.length; i++) {
        for (let u = 0; u <= SCENES[i].len; u += 0.2) {
          await page.evaluate(([scene, at]) => window.__repforgeLandingFeatureSeek(scene, at), [i, u]);
          const read = await page.evaluate(readBad);
          if (read.badText.length || read.badStyle.length) bad.push({ scene: i, at: Math.round(u * 10) / 10, ...read });
        }
      }
      const library = await page.evaluate(() => document.querySelector("#firstRunFeatTab2 .firstrun-feat__title").textContent);
      await context.close();
      assert.deepEqual(errors, []);
      assert.deepEqual(bad.slice(0, 3), []);
      const shown = (Math.floor(EXERCISE_LIBRARY.length / 100) * 100).toLocaleString(lang === "pt" ? "pt-BR" : "en-US");
      assert(library.includes(shown), `the library tab reads ${library}, expected ${shown}`);
    });
  }
  await check("at 390 the camera keeps the app's body text at 13 px or more once each establishing shot has passed", async () => {
    const { context, page } = await landing(browser);
    await scrollToPanel(page);
    const low = [];
    for (let i = 0; i < SCENES.length; i++) {
      // The establishing shot (the whole screen) and the move off it take the first two shots' time.
      const from = SHOTS[i][1].at + 0.6;
      for (let u = from; u <= SCENES[i].len; u += 0.25) {
        await page.evaluate(([scene, at]) => window.__repforgeLandingFeatureSeek(scene, at), [i, u]);
        const zoom = await page.evaluate(() => window.__repforgeLandingProof().featureZoom);
        if (!(zoom * 16 >= 13)) low.push({ scene: i, at: Math.round(u * 100) / 100, zoom });
      }
    }
    await context.close();
    assert.deepEqual(low.slice(0, 5), []);
  });
  for (const [width, height] of [[390, 844], [1440, 900]]) for (const lang of ["en", "pt"]) {
    await check(`[${width} ${lang}] no frame edge cuts a text line or a control while a shot holds`, async () => {
      const { context, page } = await landing(browser, { lang, width, height });
      await scrollToPanel(page);
      const cuts = [];
      for (let i = 0; i < SCENES.length; i++) for (let k = 1; k < SHOTS[i].length; k++) {
        const rest = SHOTS[i][k].at + 0.6, end = k + 1 < SHOTS[i].length ? SHOTS[i][k + 1].at : SCENES[i].len;
        for (const u of [(rest + end) / 2, end - 0.05]) {
          if (u < rest) continue;
          await page.evaluate(([scene, at]) => window.__repforgeLandingFeatureSeek(scene, at), [i, u]);
          // a tab change cross-fades its window (a little scaled while it arrives): measure the window at rest
          await page.evaluate(() => Promise.all(document.querySelector(".firstrun-feat__win.is-current").getAnimations()
            .map((animation) => animation.finished.catch(() => {}))));
          const cut = await page.evaluate(() => {
            const win = document.querySelector(".firstrun-feat__win.is-current"), W = win.getBoundingClientRect(), out = [];
            const shown = (el) => { for (let n = el; n && n !== win; n = n.parentElement) if (+getComputedStyle(n).opacity < 0.05) return false; return true; };
            const rects = [], walker = document.createTreeWalker(win, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const t = walker.currentNode; if (!t.nodeValue.trim() || !shown(t.parentElement)) continue;
              const range = document.createRange(); range.selectNodeContents(t);
              for (const q of range.getClientRects()) rects.push([t.nodeValue.trim().slice(0, 24), q]);
            }
            for (const el of win.querySelectorAll(".pchip,.picktab,.firstrun-fx__pill,.minibar__go,.minibar__chip,.firstrun-fx__search,.firstrun-fx__seg span,.librow__check,.firstrun-fx__card,.firstrun-fx__res,.minibar,.firstrun-fx__dock"))
              if (shown(el)) rects.push([el.className.split(" ")[0], el.getBoundingClientRect()]);
            for (const [name, q] of rects) {
              if (q.height < 2) continue;
              const crosses = (edge) => q.top < edge - 0.5 && q.bottom > edge + 0.5;
              if (crosses(W.top) || crosses(W.bottom)) out.push(name);
            }
            return out;
          });
          if (cut.length) cuts.push({ scene: i, shot: k, at: Math.round(u * 100) / 100, cut: cut.slice(0, 3) });
        }
      }
      await context.close();
      assert.deepEqual(cuts.slice(0, 4), []);
    });
  }
  // Tab 5's bar is the app's (owner, iPhone, 2026-10-31): no ring, the +30s and Resume words centred in their pills, the
  // bar 8 px above the dock, and the list ending 8 px or more above the bar, so nothing runs behind it.
  for (const lang of ["en", "pt"]) {
    await check(`[${lang}] the rest-timer beat's bar: no ring, centred pill words, 8 px above the dock, nothing behind it`, async () => {
      const { context, page } = await landing(browser, { lang });
      await scrollToPanel(page);
      const bad = [];
      for (const u of [2.5, 4.1, 6]) {
        await page.evaluate(([scene, at]) => window.__repforgeLandingFeatureSeek(scene, at), [4, u]);
        const m = await page.evaluate(() => [...document.querySelectorAll(".firstrun-feat__win.is-current .firstrun-fx__hist")]
          .filter((h) => +getComputedStyle(h).opacity > .5).map((h) => {
            const bar = h.querySelector(".minibar"), dock = h.querySelector(".firstrun-fx__dock"), clip = h.querySelector(".firstrun-fx__hclip");
            const pills = [...bar.querySelectorAll(".minibar__chip,.minibar__go")].map((pill) => {
              const r = pill.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(pill); const w = range.getBoundingClientRect();
              const k = r.height / pill.offsetHeight;
              return Math.abs((w.top + w.height / 2 - (r.top + r.height / 2)) / k);
            });
            return { rings: h.querySelectorAll(".minibar__ring").length, line: !!bar.querySelector(".minibar__line .minibar__fill"), pills,
              gap: dock.offsetTop - (bar.offsetTop + bar.offsetHeight), clear: bar.offsetTop - (clip.offsetTop + clip.offsetHeight) };
          }));
        for (const x of m) if (x.rings || !x.line || x.pills.some((off) => off > 1) || x.gap !== 8 || x.clear < 8) bad.push({ u, ...x });
      }
      await context.close();
      assert.deepEqual(bad, []);
    });
  }
  await check("with no usable platform clock the tabs still play, on their own frame deltas, with finite text", async () => {
    const { context, page, errors } = await landing(browser, { hostileClock: true });
    await scrollToPanel(page);
    await page.waitForTimeout(400);
    const first = await page.evaluate(() => window.__repforgeLandingProof());
    await page.waitForTimeout(1500);
    const later = await page.evaluate(() => window.__repforgeLandingProof());
    const read = await page.evaluate(readBad);
    await context.close();
    assert.deepEqual(errors, []);
    assert(Number.isFinite(later.featureTime), `the tabs' time is a number: ${later.featureTime}`);
    assert(later.featurePlaying && later.featureTime > first.featureTime, `the tabs advance: ${first.featureTime} -> ${later.featureTime}`);
    assert.deepEqual(read, { badText: [], badStyle: [] });
  });
  await check("the player runs only on screen, and a tab tap jumps to its scene", async () => {
    const { context, page } = await landing(browser);
    await page.waitForTimeout(300);
    const offscreen = await page.evaluate(() => window.__repforgeLandingProof());
    await scrollToPanel(page);
    await page.waitForTimeout(600);
    const onscreen = await page.evaluate(() => window.__repforgeLandingProof());
    await page.click("#firstRunFeatTab3");
    await page.waitForTimeout(200);
    const jumped = await page.evaluate(() => ({ live: window.__repforgeLandingProof(),
      selected: document.querySelector('[data-feature][aria-selected="true"]')?.id, panel: document.querySelector("#firstRunFeatPanel").getAttribute("aria-labelledby"),
      current: [...document.querySelectorAll(".firstrun-feat__win")].findIndex((win) => win.classList.contains("is-current")) }));
    await context.close();
    assert(!offscreen.featurePlaying, "off screen the tabs do not play");
    assert(onscreen.featurePlaying, "on screen the tabs play");
    assert.equal(jumped.live.feature, 3);
    assert.deepEqual([jumped.selected, jumped.panel, jumped.current], ["firstRunFeatTab3", "firstRunFeatTab3", 3]);
  });
  await check("under reduced motion nothing plays and each tab is a still", async () => {
    const { context, page } = await landing(browser, { reducedMotion: "reduce" });
    await scrollToPanel(page);
    await page.waitForTimeout(600);
    const live = await page.evaluate(() => window.__repforgeLandingProof());
    await page.click("#firstRunFeatTab1");
    await page.waitForTimeout(300);
    const still = await page.evaluate(() => ({ live: window.__repforgeLandingProof(),
      progress: document.querySelector("#firstRunFeatTab1").style.getPropertyValue("--feature-progress"),
      swapped: getComputedStyle(document.querySelector('[data-feature-screen="1"] .firstrun-fx__swapb')).opacity }));
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.__repforgeLandingProof());
    await context.close();
    assert(!live.featurePlaying && !after.featurePlaying, "no clock runs");
    assert.equal(still.live.feature, 1);
    assert.equal(after.featureTime, still.live.featureTime, "the still does not move");
    assert.equal(still.progress, "1", "the tab's line is full");
    assert.equal(still.swapped, "1", "the still is the scene's end: the exercise replaced");
  });
} finally {
  await browser.close();
}
console.log(failed ? `\nlanding features: ${failed} failed` : "\nlanding features: all passed");
process.exit(failed ? 1 : 0);
