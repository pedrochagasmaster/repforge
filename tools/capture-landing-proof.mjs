#!/usr/bin/env node
/**
 * Landing proof tooling (Plan 064 R2a-3). Everything here drives the real app;
 * nothing is redrawn, copied from a prototype or hand-typed. (The scroll walkthrough's
 * wt-* screens and lens spots retired with it on 2026-10-29: the proof is now the
 * app's own Focus markup, played on the page.)
 *
 *   --proof <dir>      Capture the landing's real-app images into <dir>:
 *                        paste-review-{en,pt}-{light,dark}.webp            (4; the import-review screen)
 *                        exercise-chart-{en,pt}-{light,dark}.webp         (4; the best e1RM chart region of the exercise page, from the chart fixture)
 *                        landing-proof-spots.json                          (the paste-review counts)
 *                        proof-report.json                                 (sizes, counts, review rows)
 *                      Prints the linked / to-review counts read off each captured paste-review
 *                      DOM. Never writes into assets/brand/: copy the files there deliberately.
 *     --scenes a,b       limit to some of paste-review,exercise-chart
 *     --spots-only       measure and write the JSON only (no WebP files)
 *   --check            Capture nothing. Re-measure the paste-review counts and fail when the stored
 *                      JSON no longer matches the live DOM.
 *     --spots <file>     the stored JSON (default assets/brand/landing-proof-spots.json)
 *   --matrix <dir>     (historical) landing layout matrix. Its composition assertions belonged to the
 *                      retired landing; only generic geometry / reachability / image checks remain, so it
 *                      depends on no landing composition markup. --fault-overflow still proves the
 *                      overflow check bites.
 *
 * Every capture fails when a retired selector (RETIRED_SELECTORS: the inline rest and its pill, the import review's old head)
 * is on screen; --fault-retired puts one there so a test can prove that check bites.
 *
 * Every mode reads REPFORGE_URL (default http://localhost:8000/) and, when the pinned Chromium is not on
 * the default path, REPFORGE_CHROME.
 *
 * Interim status of each image this produces: assets/brand/README.md.
 */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {launchChromium, waitForAppBoot} from '../test/browser.mjs';
import {MINIMAL_PAYLOAD, BUILT_IN_IDS} from '../test/fixtures/shared-setup.mjs';
import {settle} from './ui-screens/session.mjs';
import {realisticState} from './landing-prototype/fixture.mjs';

const ROOT = new URL('../', import.meta.url);
export const DEFAULT_SPOTS_FILE = fileURLToPath(new URL('assets/brand/landing-proof-spots.json', ROOT));
export const PROOF_FRAME = {width: 390, height: 844, scale: 2};
export const SAFE_INSETS = {top: 59, bottom: 34};
export const SPOT_SCHEMA = 1;
export const WEBP_QUALITY = 0.86;
export const LANGS = ['en', 'pt'];
export const PASTE_SCENE = 'paste-review';
export const PASTE_THEMES = ['light', 'dark'];
export const CHART_SCENE = 'exercise-chart';
export const CHART_THEMES = ['light', 'dark'];
/** The squat the landing's chart figures come from: 92.5 to 100 kg over 4 sessions (owner decision L-2). */
export const CHART_LIFT = 'library:sq_bb';
/**
 * The chart capture's phone width and pixel density. The image is a crop of the content column of a 320 px phone, so its
 * natural CSS width is its pixel width divided by the scale, and the landing slot (at most 230 px) draws it at or above
 * CHART_MIN_SCALE: effective scale = rendered width / natural CSS width.
 */
export const CHART_FRAME = {width: 320, scale: 2};
export const CHART_MIN_SCALE = 0.75;
export const CHART_FIGURES = {from: 92.5, to: 100, sessions: 4};
/**
 * Selectors of retired UI. No regenerated capture may contain one (Plan 064 C-03: never ship a screenshot of a
 * retired UI), and no capture target may name one. `.restinline` and `.restpad` were the inline rest (R3f)
 * and `#woRest` its header pill before the rest timer redesign; `#importReview .exview-head` was the import
 * review's head before R4c.
 */
export const RETIRED_SELECTORS = ['.restinline', '.restpad', '#woRest', '#importReview .exview-head'];

/** Runs in the page: the retired selectors that match something on screen (the hidden shell nodes do not count). */
export function visibleRetired(selectors) {
  return selectors.filter(selector => [...document.querySelectorAll(selector)]
    .some(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'));
}

/** The import review's crop: from its head (R4c: `.onb__head`, the shared onboarding bar) through the first row. */
export const PASTE_TARGETS = {head: '#importReview .onb__head', firstRow: '#importRows .improw'};

/**
 * The exercise page as the Progress strength list opens it (R3i): the scope and metric toggles, the plot that
 * snaps to a session, and the session table under it. The capture selects best e1RM, the metric the landing's
 * caption explains, and is cropped to the chart region: the metric toggle through the plot's readout line (the table stays out).
 */
export const CHART_TARGETS = {
  page: '#exercise.exview--chart',
  head: '#exBack',
  plot: '#exDetail .exchart__plot',
  e1rm: '#exDetail [data-metric="e1rm"]',
  rows: '#exDetail .exrow',
  figs: '#exDetail .exchart__figs',
  readout: '#exDetail .exchart__readout',
};

export const pasteFile = (lang, theme) => `paste-review-${lang}-${theme}.webp`;
export const chartFile = (lang, theme) => `exercise-chart-${lang}-${theme}.webp`;
export const outputFiles = () => [
  ...LANGS.flatMap(lang => PASTE_THEMES.map(theme => pasteFile(lang, theme))),
  ...LANGS.flatMap(lang => CHART_THEMES.map(theme => chartFile(lang, theme))),
];

/** Compare the stored paste-review counts with a fresh measurement. Returns problem strings; [] means no drift. */
export function compareSpots(stored, measured) {
  if (!stored || typeof stored !== 'object') return ['stored spots are missing or not an object'];
  const problems = [];
  if (stored.schema !== SPOT_SCHEMA) problems.push(`schema ${stored.schema} != ${SPOT_SCHEMA}`);
  for (const key of ['width', 'height', 'scale']) {
    if (stored.frame?.[key] !== measured.frame[key]) problems.push(`frame.${key} ${stored.frame?.[key]} != ${measured.frame[key]}`);
  }
  if (stored.scenes) problems.push('stored spots still carry the retired walkthrough scenes');
  if (!Object.keys(stored.pasteReview || {}).length) {
    problems.push('stored counts are empty (placeholder): run --proof <dir> and commit the generated landing-proof-spots.json');
    return problems;
  }
  const storedPaste = stored.pasteReview || {};
  for (const [lang, counts] of Object.entries(measured.pasteReview || {})) {
    if (!storedPaste[lang]) { problems.push(`pasteReview.${lang}: not stored`); continue; }
    for (const key of ['linked', 'review', 'custom']) {
      if (storedPaste[lang][key] !== counts[key]) problems.push(`pasteReview.${lang}.${key}: stored ${storedPaste[lang][key]} but live ${counts[key]}`);
    }
  }
  return problems;
}

/** Dimensions of a WebP (lossy VP8 or extended VP8X), or null when the bytes are not WebP. */
export function webpSize(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return {width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff};
  if (kind === 'VP8X') return {width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3)};
  return null;
}

/** The coach message and the reply an assistant would give for it, both derived from the landing catalog. */
export function pasteSample(catalog) {
  const message = catalog['landing.ways.paste.message'];
  assert(message, 'landing.ways.paste.message is missing from the catalog');
  const [header, ...lines] = message.split('\n');
  const day = header.split('·')[0].trim();
  const exercises = lines.map((line, index) => {
    const match = /^(.+?)\s+(\d+)x(\d+)-(\d+)$/.exec(line.trim());
    assert(match, `paste sample line is not "<name> SxA-B": ${JSON.stringify(line)}`);
    return {day, order: index + 1, name: match[1], sets: Number(match[2]), min: Number(match[3]), max: Number(match[4])};
  });
  return {message, reply: JSON.stringify({version: 3, meta: {name: day}, exercises}), exercises};
}

const catalogs = {};
async function catalog(lang) {
  catalogs[lang] ||= JSON.parse(await readFile(new URL(`i18n-${lang}.json`, ROOT), 'utf8'));
  return catalogs[lang];
}

/** Every one-time guide dismissed at its current version: a returning lifter's screen has none of them. */
const {GUIDE_DEFINITIONS} = createRequire(import.meta.url)('../guide-registry.js');
const QUIET_GUIDES = Object.fromEntries(GUIDE_DEFINITIONS.map(guide =>
  [guide.id, {version: guide.version, status: 'dismissed', lastTransitionAt: null}]));

const base = process.env.REPFORGE_URL || 'http://localhost:8000/';

async function safeInsets(page) {
  await page.route('**/styles.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: (await response.text())
      .replaceAll('env(safe-area-inset-top)', `${SAFE_INSETS.top}px`)
      .replaceAll('env(safe-area-inset-bottom)', `${SAFE_INSETS.bottom}px`)});
  });
}

/**
 * One isolated page. `source` seeds `seed` as the program and marks the landing seen;
 * `program: false, seen: true` is a fresh device that skips the landing;
 * `quiet` marks every one-time guide seen so a returning lifter's screen is captured.
 */
async function open(browser, {width = 430, height = 932, lang = 'en', theme = 'light', scale = 1, dpr,
  source = false, program = source, seen = source, quiet = false, insets = false, forcedColors = 'none', reducedMotion = 'reduce',
  seed = null}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr ?? (source ? 3 : 1),
    locale: lang === 'pt' ? 'pt-BR' : 'en-US', timezoneId: 'UTC', colorScheme: theme,
    serviceWorkers: 'block', reducedMotion, forcedColors});
  const page = await context.newPage();
  if (insets) await safeInsets(page);
  await page.clock.setFixedTime(new Date('2026-08-31T12:00:00Z'));
  const state = seed ? structuredClone(seed) : {settings: {}};
  state.settings.lang = lang;
  // The program row's name is the catalog's own English name (never a custom alias), so the app shows
  // the catalog's namePt automatically when lang is 'pt' (app.js's stored-name-equals-catalog-name check);
  // nothing needs renaming here.
  await page.addInitScript(({state, theme, program, seen, guideState, scale}) => {
    if (!sessionStorage.getItem('landing-proof-seeded')) {
      localStorage.setItem('repforge_ui_v1', JSON.stringify({theme, ...(seen ? {entryLandingSeen: true} : {}), ...(guideState ? {guideState} : {})}));
      if (program) localStorage.setItem('repforge_v1', JSON.stringify(state));
      sessionStorage.setItem('landing-proof-seeded', '1');
    }
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = `${scale * 100}%`;
    }, {once: true});
  }, {state, theme, program, seen, guideState: quiet ? QUIET_GUIDES : null, scale});
  await page.goto(base);
  await waitForAppBoot(page, {base});
  return {page, context, state};
}

/**
 * --fault-retired: put a retired element on screen so a test can prove the retired-UI check bites. Every capture gets
 * the retired inline rest clock; the paste-review capture also gets the import review's old head.
 */
async function injectRetiredFault(page) {
  await page.evaluate(() => {
    const clock = document.createElement('div');
    clock.className = 'restinline';
    clock.style.cssText = 'position:fixed;top:0;left:0;display:block;width:8px;height:8px';
    document.body.append(clock);
    const review = document.querySelector('#importReview');
    if (review) { const head = document.createElement('div'); head.className = 'exview-head'; head.textContent = 'retired'; review.prepend(head); }
  });
}

/** Encode a PNG as WebP in the page's own Chromium; no image tool is needed. */
async function encodeWebp(page, png) {
  const b64 = await page.evaluate(async ({data, quality}) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/webp', quality).split(',')[1];
  }, {data: png.toString('base64'), quality: WEBP_QUALITY});
  return Buffer.from(b64, 'base64');
}

/** The import-review screen for the final page's sample coach message, through the real paste door. */
async function capturePasteReview(browser, lang, theme, {images}) {
  const name = `${PASTE_SCENE}-${lang}-${theme}`;
  const sample = pasteSample(await catalog(lang));
  const {page, context} = await open(browser, {width: PROOF_FRAME.width, height: 1400, dpr: PROOF_FRAME.scale, lang, theme,
    seen: true, quiet: true, insets: true});
  try {
    await page.evaluate(() => window.closeFirstRun?.());
    await page.evaluate(() => window.startOnboarding('settings'));
    await page.waitForSelector('#onboarding.active .entry__hub', {timeout: 20000});
    await page.click('[data-entry-hub="import"]');
    await page.click('#onbNext');
    await page.click('#entryFreeformSwitch');
    await page.fill('#entryFreeformIn', sample.message);
    await page.waitForFunction(() => document.querySelector('#entryFreeformNeeds')?.hidden === true, undefined, {timeout: 20000});
    await page.click('#entryFreeformContinue');
    await page.click('#entryFreeformCopy');
    await page.waitForSelector('#entryFreeformOut', {timeout: 20000});
    await page.fill('#entryFreeformOut', sample.reply);
    await page.click('#entryFreeformReview');
    await page.waitForSelector('#importReview.active #importRows .improw', {timeout: 25000});
    await page.waitForFunction(() => document.querySelector('#toast')?.classList.contains('hidden') !== false, undefined, {timeout: 10000});
    await settle(page);
    const found = await page.evaluate(() => ({
      counts: [...document.querySelectorAll('#importCounts .impcount')].map(item => ({
        n: Number(item.querySelector('b').textContent), label: item.textContent.replace(/^\s*\d+/, '').trim()})),
      rows: [...document.querySelectorAll('#importRows .improw')].map(row => ({
        typed: row.querySelector('.improw__from')?.textContent.trim(),
        suggested: row.querySelector('.improw__name')?.textContent.trim(),
        status: row.querySelector('.impbadge')?.textContent.trim(),
        open: row.classList.contains('is-open')})),
    }));
    const words = await catalog(lang);
    const byLabel = key => found.counts.find(item => item.label === words[`import.count_${key}`]);
    const [linked, review, custom] = ['linked', 'review', 'custom'].map(key => byLabel(key)?.n);
    assert([linked, review, custom].every(Number.isInteger), `${name}: import counts not readable from #importCounts: ${JSON.stringify(found.counts)}`);
    assert.equal(found.rows.length, sample.exercises.length, `${name}: one review row per exercise in the sample message`);
    // The review lists rows that still need a decision first, so compare as sets.
    assert.deepEqual(found.rows.map(row => row.typed).sort(), sample.exercises.map(item => item.name).sort(), `${name}: the typed names are the sample message's`);
    if (values['fault-retired']) await injectRetiredFault(page);
    const retired = await page.evaluate(visibleRetired, RETIRED_SELECTORS);
    assert.deepEqual(retired, [], `${name}: the frame shows retired UI`);
    let webp = null;
    if (images) {
      const clip = await page.evaluate(selectors => {
        const top = document.querySelector(selectors.head).getBoundingClientRect().top;
        // Header, heading, the linked / to-review counts and the first review row: what the landing's alt describes.
        const bottom = document.querySelector(selectors.firstRow).getBoundingClientRect().bottom;
        return {x: 0, y: Math.max(0, Math.floor(top)), width: innerWidth, height: Math.ceil(bottom - top) + 12};
      }, PASTE_TARGETS);
      webp = await encodeWebp(page, await page.screenshot({type: 'png', clip}));
    }
    return {counts: {linked, review, custom}, rows: found.rows, webp};
  } finally {await context.close();}
}

/**
 * The exercise page for the landing's squat, best e1RM selected. The state is the one the landing's chart
 * figures come from (tools/landing-prototype/fixture.mjs), and the figures the page draws are checked against
 * the Progress model's own reading of that history, which is what landing.chart.caption pours in.
 */
async function captureChart(browser, lang, theme, {images}) {
  const name = `${CHART_SCENE}-${lang}-${theme}`;
  const {page, context} = await open(browser, {width: CHART_FRAME.width, height: 1300, dpr: CHART_FRAME.scale, lang, theme,
    source: true, quiet: true, insets: true, seed: realisticState(lang)});
  try {
    await page.evaluate(key => window.openExerciseView(key, 'stats'), CHART_LIFT);
    await page.waitForSelector(`${CHART_TARGETS.page} ${CHART_TARGETS.e1rm}`, {timeout: 20000});
    await page.click(CHART_TARGETS.e1rm);
    await page.waitForSelector(`${CHART_TARGETS.e1rm}[aria-pressed="true"]`, {timeout: 20000});
    await settle(page);
    const found = await page.evaluate(({targets, lift}) => {
      const rows = [...document.querySelectorAll(targets.rows)].map(row => {
        const cells = [...row.children].map(cell => cell.textContent.trim());
        return {date: cells[0], top: Number(cells[1].split('\u00d7')[0].trim().replace(',', '.')), set: cells[1], e1rm: cells[2]};
      });
      const state = JSON.parse(localStorage.getItem('repforge_v1'));
      const series = RepForgeProgressModel.buildStrengthEvidence('all-history', 'ex-squat', state.log, {started: state.programMeta.started});
      const pressed = [...document.querySelectorAll('#exDetail [aria-pressed="true"]')].map(button => button.dataset.metric || button.dataset.scope);
      return {
        rows, pressed, lift,
        plot: !!document.querySelector(targets.plot), canvas: !!document.querySelector('#exChart'),
        figs: [...document.querySelectorAll(`${targets.figs} b`)].map(node => node.textContent.trim()),
        model: {from: series.points[0].value, to: series.points.at(-1).value, sessions: series.evidenceCount},
      };
    }, {targets: CHART_TARGETS, lift: CHART_LIFT});
    assert(found.plot, `${name}: the exercise page draws the chart (${CHART_TARGETS.plot})`);
    assert(!found.canvas, `${name}: the page is the Progress chart, not the pre-R3i canvas page`);
    assert(found.pressed.includes('e1rm'), `${name}: the best e1RM metric is pressed (${found.pressed})`);
    assert.deepEqual(found.model, CHART_FIGURES, `${name}: the Progress model reads the landing's figures from this history`);
    // The table is the chart's accessible twin: its oldest and newest top sets and its row count are the caption's numbers.
    assert.equal(found.rows.length, CHART_FIGURES.sessions, `${name}: one table row per session`);
    assert.equal(found.rows.at(-1).top, CHART_FIGURES.from, `${name}: the oldest session drawn is ${CHART_FIGURES.from} kg`);
    assert.equal(found.rows[0].top, CHART_FIGURES.to, `${name}: the newest session drawn is ${CHART_FIGURES.to} kg`);
    if (values['fault-retired']) await injectRetiredFault(page);
    const retired = await page.evaluate(visibleRetired, RETIRED_SELECTORS);
    assert.deepEqual(retired, [], `${name}: the frame shows retired UI`);
    let webp = null;
    if (images) {
      // R7 V-04 (owner decision #295 comment 5965828337): crop to the chart region, from the metric toggle (best e1RM
      // pressed) through the plot's readout line, at the content width of a CHART_FRAME.width phone. The landing slot
      // is 230 px at most, so a page-wide 390 px capture drew 4-7 px text; this one stays at or above CHART_MIN_SCALE.
      const clip = await page.evaluate(targets => {
        const boxes = [document.querySelector(targets.e1rm).parentElement, document.querySelector(targets.plot), document.querySelector(targets.readout)]
          .map(node => node.getBoundingClientRect());
        const pad = 2;
        const left = Math.floor(Math.min(...boxes.map(box => box.left))) - pad;
        const right = Math.ceil(Math.max(...boxes.map(box => box.right))) + pad;
        const top = Math.max(0, Math.floor(boxes[0].top) - pad);
        return {x: Math.max(0, left), y: top, width: right - Math.max(0, left), height: Math.ceil(boxes[2].bottom) + pad - top};
      }, CHART_TARGETS);
      webp = await encodeWebp(page, await page.screenshot({type: 'png', clip}));
    }
    return {figures: found.model, rows: found.rows, figs: found.figs, pressed: found.pressed, plot: found.plot, webp};
  } finally {await context.close();}
}

/** Run the selected captures. Returns the measured counts and (with images) the WebP buffers by file name. */
export async function runProof(browser, {scenes, images, log = () => {}}) {
  const measured = {schema: SPOT_SCHEMA, frame: {...PROOF_FRAME}, pasteReview: {}};
  const files = {};
  const review = {};
  if (scenes.includes(PASTE_SCENE)) {
    for (const lang of LANGS) for (const theme of PASTE_THEMES) {
      const result = await capturePasteReview(browser, lang, theme, {images});
      review[`${lang}-${theme}`] = {counts: result.counts, rows: result.rows};
      if (result.webp) files[pasteFile(lang, theme)] = result.webp;
      log(`ok ${PASTE_SCENE} ${lang} ${theme}: linked ${result.counts.linked}, to review ${result.counts.review}, custom ${result.counts.custom}; `
        + result.rows.map(row => `${row.typed} -> ${row.suggested} [${row.status}]`).join('; '));
    }
    for (const lang of LANGS) {
      const [light, dark] = PASTE_THEMES.map(theme => review[`${lang}-${theme}`].counts);
      assert.deepEqual(light, dark, `${PASTE_SCENE} ${lang}: light and dark capture disagree on the counts`);
      measured.pasteReview[lang] = light;
    }
  }
  if (scenes.includes(CHART_SCENE)) {
    for (const lang of LANGS) for (const theme of CHART_THEMES) {
      const result = await captureChart(browser, lang, theme, {images});
      review[`${CHART_SCENE}-${lang}-${theme}`] = {page: '#exercise', plot: result.plot, pressed: result.pressed, figures: result.figures, rows: result.rows, figs: result.figs};
      if (result.webp) files[chartFile(lang, theme)] = result.webp;
      log(`ok ${CHART_SCENE} ${lang} ${theme}: ${result.figures.from} to ${result.figures.to} kg over ${result.figures.sessions} sessions; `
        + `table ${result.rows.map(row => row.set).join(', ')}; figures ${result.figs.join(' | ')}`);
    }
  }
  return {measured, files, review};
}

/* ------------------------------------------------------------------ */
/* Historical layout matrix (generic checks only)                       */
/* ------------------------------------------------------------------ */

const matrix = [
  ...[320, 360, 390, 430, 768].map(width => ({name: `${width}-en`, width})),
  {name: '320-pt', width: 320, lang: 'pt'}, {name: '390-pt', lang: 'pt'}, {name: '390-dark', theme: 'dark'},
  {name: '390-pt-dark', lang: 'pt', theme: 'dark'},
  {name: '320-text200', width: 320, scale: 2}, {name: '320-pt-text200', width: 320, scale: 2, lang: 'pt'}, {name: '390-text200', scale: 2}, {name: '390-pt-text200', lang: 'pt', scale: 2},
  {name: '390-shared', route: 'shared'}, {name: '390-shared-pt', route: 'shared', lang: 'pt'},
  {name: '390-invalid', route: 'invalid'}, {name: '390-reduced', reducedMotion: 'reduce'},
  {name: '390-forced-colors', forcedColors: 'active'}, {name: '390-safe-insets', insets: true},
];

/**
 * Generic landing assertions: no horizontal overflow, every product image the page
 * shows loads, every visible control is reachable and fits the viewport. Nothing here
 * names a landing section, stage, strip or beat.
 */
async function assertLanding(page, name) {
  const images = page.locator('#firstRun img[src]:visible');
  const imageCount = await images.count();
  for (let index = 0; index < imageCount; index++) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    const src = await image.getAttribute('src');
    assert(await image.evaluate(node => node.complete && node.naturalWidth > 0), `${name}: image ${src} loaded`);
  }
  if (values['fault-overflow']) await page.locator('#firstRun').evaluate(node => {
    const wide = document.createElement('button');
    wide.type = 'button';
    wide.textContent = 'overflow fault';
    wide.style.cssText = 'display:block;width:200vw';
    node.firstElementChild.append(wide);
  });
  // Only the document's own scroll width is a defect: the landing clips its decorative bleed.
  const geometry = await page.evaluate(() => {
    const root = document.documentElement, landing = document.querySelector('#firstRun');
    return {document: root.scrollWidth - root.clientWidth, landing: landing.scrollWidth - landing.clientWidth};
  });
  assert(geometry.document <= 1, `${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  const controls = page.locator('#firstRun button:visible, #firstRun a[href]:visible, #firstRun select:visible');
  const count = await controls.count();
  assert(count > 0, `${name}: landing has controls`);
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    const viewport = page.viewportSize();
    assert(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1,
      `${name}: control ${index + 1} fits after scrolling`);
    await control.click({trial: true});
  }
  await page.locator('#firstRun').evaluate(node => {node.scrollTop = 0;});
  await settle(page);
  return {controls: count, images: imageCount, overflow: geometry};
}

async function captureMatrix(browser, output, report) {
  const selected = values.cases ? values.cases.split(',') : matrix.map(item => item.name);
  assert(selected.length && selected.every(name => matrix.some(item => item.name === name)), 'Every requested case must exist');
  for (const item of matrix.filter(item => selected.includes(item.name))) {
    const config = {width: 390, height: item.width === 768 ? 1024 : 844, lang: 'en', theme: 'light', reducedMotion: 'no-preference', ...item};
    const {page, context} = await open(browser, config);
    try {
      if (item.route === 'shared') {
        const payload = structuredClone(MINIMAL_PAYLOAD);
        payload.settings.lang = config.lang;
        const encoded = await page.evaluate(async ({payload, ids}) => {
          const result = await window.RepForgeSharedSetup.encode(payload, {builtInIds: ids});
          if (!result.ok) throw Error('Could not encode proof setup fixture');
          return result.value;
        }, {payload, ids: [...BUILT_IN_IDS]});
        await page.goto(new URL(`index.html#setup=${encoded}`, base).href).catch(() => {
          throw Error(`${item.name}: setup navigation failed; URL omitted`);
        });
        await waitForAppBoot(page, {base});
      } else if (item.route === 'invalid') {
        await page.goto(new URL('index.html#setup=invalid', base).href);
        await waitForAppBoot(page, {base});
      }
      await settle(page);
      const checks = await assertLanding(page, item.name);
      await page.screenshot({path: `${output}/${item.name}.png`});
      const fullHeight = await page.locator('#firstRun').evaluate(node => Math.ceil(node.scrollHeight) + 80);
      await page.setViewportSize({width: config.width, height: Math.max(config.height, fullHeight)});
      await settle(page);
      await page.screenshot({path: `${output}/${item.name}-full.png`});
      report.cases.push({name: item.name, ...checks});
      console.log(`PASS ${item.name}: ${checks.images} product images loaded; ${checks.controls} reachable controls; no horizontal overflow`);
    } finally {await context.close();}
  }
}

/* ------------------------------------------------------------------ */
/* Entry                                                                */
/* ------------------------------------------------------------------ */

let values = {};

async function proofMode(browser, {check}) {
  const allScenes = [PASTE_SCENE, CHART_SCENE];
  const scenes = values.scenes ? values.scenes.split(',') : allScenes;
  assert(scenes.length && scenes.every(name => allScenes.includes(name)), `--scenes must be some of ${allScenes.join(',')}`);
  const images = !check && !values['spots-only'];
  const {measured, files, review} = await runProof(browser, {scenes, images, log: line => console.log(line)});
  if (check) {
    const file = resolve(values.spots || DEFAULT_SPOTS_FILE);
    let stored;
    try {stored = JSON.parse(await readFile(file, 'utf8'));} catch (error) {
      throw new Error(`cannot read stored spots ${file}: ${error.message}`);
    }
    const problems = compareSpots(stored, measured);
    if (problems.length) {
      console.error(`FAIL landing proof counts are stale (${file}):\n  ${problems.join('\n  ')}\nRegenerate with: node tools/capture-landing-proof.mjs --proof <dir>`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS landing proof counts match the live DOM (${Object.keys(measured.pasteReview).length} paste-review languages)`);
    return;
  }
  const output = resolve(values.proof);
  await mkdir(output, {recursive: true});
  const sizes = {};
  for (const [file, buffer] of Object.entries(files)) {
    await writeFile(`${output}/${file}`, buffer);
    sizes[file] = {bytes: buffer.length, ...webpSize(buffer)};
  }
  await writeFile(`${output}/landing-proof-spots.json`, `${JSON.stringify(measured, null, 2)}\n`);
  await writeFile(`${output}/proof-report.json`, `${JSON.stringify({sizes, pasteReview: review}, null, 2)}\n`);
  for (const [file, info] of Object.entries(sizes)) console.log(`wrote ${file} ${info.width}x${info.height} ${info.bytes} bytes`);
  for (const lang of LANGS) {
    const counts = measured.pasteReview[lang];
    if (counts) console.log(`paste-review ${lang}: ${counts.linked} linked, ${counts.review} to review, ${counts.custom} custom`);
  }
  if (measured.pasteReview.en && measured.pasteReview.pt) {
    const same = ['linked', 'review', 'custom'].every(key => measured.pasteReview.en[key] === measured.pasteReview.pt[key]);
    console.log(same ? 'paste-review: EN and PT counts agree' : 'paste-review: EN and PT counts DISAGREE (the landing alt text must use the true count per language)');
  }
}

async function main() {
  ({values} = parseArgs({options: {
    cases: {type: 'string'}, matrix: {type: 'string'}, proof: {type: 'string'}, check: {type: 'boolean'},
    spots: {type: 'string'}, scenes: {type: 'string'}, 'spots-only': {type: 'boolean'},
    'fault-overflow': {type: 'boolean'}, 'fault-retired': {type: 'boolean'},
  }}));
  assert([values.matrix, values.proof, values.check].filter(Boolean).length === 1,
    'Choose exactly one of --proof <dir>, --check, --matrix <dir>');
  const browser = await launchChromium();
  try {
    if (values.proof || values.check) {
      await proofMode(browser, {check: Boolean(values.check)});
      return;
    }
    const output = resolve(values.matrix);
    await mkdir(output, {recursive: true});
    const report = {mode: 'matrix', cases: []};
    await captureMatrix(browser, output, report);
    await writeFile(`${output}/proof.json`, `${JSON.stringify(report, null, 2)}\n`);
  } finally {await browser.close();}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
