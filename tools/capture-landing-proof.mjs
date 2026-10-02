#!/usr/bin/env node
/**
 * Landing proof tooling (Plan 064 R2a-3). Everything here drives the real app;
 * nothing is redrawn, copied from a prototype or hand-typed.
 *
 *   --proof <dir>      Capture the landing's real-app proof images into <dir>:
 *                        wt-{focus,rest,actions,note}-{en,pt}-dark.webp   (8; 390x844 @2x, dark only)
 *                        paste-review-{en,pt}-{light,dark}.webp            (4; the import-review screen)
 *                        exercise-chart-{en,pt}-{light,dark}.webp         (4; the exercise page, best e1RM, from the chart fixture)
 *                        landing-proof-spots.json                          (lens hotspots + paste counts)
 *                        proof-report.json                                 (sizes, counts, review rows)
 *                      Prints the linked / to-review counts read off each captured paste-review
 *                      DOM. Never writes into assets/brand/: copy the files there deliberately.
 *     --scenes a,b       limit to some of focus,rest,actions,note,paste-review,exercise-chart
 *     --spots-only       measure and write the JSON only (no WebP files)
 *   --check            Capture nothing. Re-measure every lens hotspot (and the paste-review counts)
 *                      and fail when the stored JSON no longer matches the live DOM, so R3 / R4 / R6
 *                      cannot ship a lens over the wrong pixels.
 *     --spots <file>     the stored JSON (default assets/brand/landing-proof-spots.json)
 *     --scenes a,b       limit the re-measure
 *   --source <dir>     430x932 @3x PNG source captures of the "add" Focus state, then the upcoming sets of
 *                      the same day in the session list (both read from the live Focus and session screens).
 *   --matrix <dir>     (historical) landing layout matrix. Its composition assertions belonged to the
 *                      retired landing; only generic geometry / reachability / image checks remain, so it
 *                      depends on no landing composition markup. --fault-overflow still proves the
 *                      overflow check bites; the --fault-narrow / --fault-wrap switches went with the
 *                      composition they targeted.
 *
 * Every proof scene fails when a retired selector (RETIRED_SELECTORS: the rest sheet, the import review's old head)
 * is on screen; --fault-retired puts one there so a test can prove that check bites.
 *
 * Every mode reads REPFORGE_URL (default http://localhost:8000/) and, when the pinned Chromium is not on
 * the default path, REPFORGE_CHROME. The Focus state is rebuilt from test/fixtures/landing-proof.json
 * (bench, 8-10 reps, last session 3 x 60 kg x 10 at RIR 2) and the tool asserts the real Focus inputs are
 * 62.5 kg x 8 before it captures, so a wrong recommendation fails here, not on the page. Safe-area insets
 * resolve to 59px / 34px (browser-layout emulation, not physical iPhone evidence). Hotspots are percentages
 * of the frame, [centre x, centre y, width, height], read from the selectors in SPOT_TARGETS, the one place
 * to edit when a surface changes. English and Portuguese must agree on every hotspot (they are stored once).
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
/** Percentage points of the frame a re-measure may move before a stored spot counts as stale. */
export const SPOT_TOLERANCE = 0.1;
export const WEBP_QUALITY = 0.86;
export const LANGS = ['en', 'pt'];
export const PASTE_SCENE = 'paste-review';
export const PASTE_THEMES = ['light', 'dark'];
export const CHART_SCENE = 'exercise-chart';
export const CHART_THEMES = ['light', 'dark'];
/** The squat the landing's chart figures come from: 92.5 to 100 kg over 4 sessions (owner decision L-2). */
export const CHART_LIFT = 'library:sq_bb';
export const CHART_FIGURES = {from: 92.5, to: 100, sessions: 4};
const NOTE = {
  en: 'Bench on 4, grip one finger past the ring.',
  pt: 'Banco no 4, pegada um dedo além da marca.',
};

/**
 * The one selector table. Every lens hotspot is a box read from these elements.
 * `card` is the Focus card in play; `rest` lives in that card's cue slot (R3f: the rest is inline, there is no
 * rest sheet); the rest are the exercise-actions and exercise-note sheets the scenes open.
 * When a surface is reshaped, edit here and re-run --proof.
 */
export const SPOT_TARGETS = {
  card: '#workout .exercise.is-current',
  cueLines: '.fx-cue__mark, .fx-cue__l1, .fx-cue__l2',
  ledgerHead: '.ledgerline__head',
  ledgerRow: '.ledgerline',
  log: '.focus-shelf .saveset',
  more: '#woOverflowBtn',
  noteRow: '#exActionNotesBtn',
  rest: '.fx-slot[data-rest="running"] .restinline',
  swap: '#exActionSubstBtn',
  note: '#exNoteText',
};

/**
 * Selectors of retired UI. No regenerated scene may contain one (Plan 064 C-03: never ship a screenshot of a
 * retired UI), and neither may the selector table above. `#restSheet` was the rest scene before R3f;
 * `#importReview .exview-head` was the import review's head before R4c.
 */
export const RETIRED_SELECTORS = ['#restSheet', '#restSheetScrim', '#importReview .exview-head'];

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
 * caption explains, and is cropped from the back link through the last table row.
 */
export const CHART_TARGETS = {
  page: '#exercise.exview--chart',
  head: '#exBack',
  plot: '#exDetail .exchart__plot',
  e1rm: '#exDetail [data-metric="e1rm"]',
  rows: '#exDetail .exrow',
  figs: '#exDetail .exchart__figs',
};

/** Scene table: the runner name, the spots it owns, and what the frame must show. */
export const PROOF_SCENES = [
  {name: 'focus', spots: ['cue', 'log', 'last'], shows: 'Focus, set 1 of 3, last session 3 x 60 x 10 RIR 2, cue 62.5 x 8'},
  {name: 'rest', spots: ['dial'], shows: 'Focus after Log set: the inline rest clock and drain bar in the cue slot, the next set cued'},
  {name: 'actions', spots: ['swap'], shows: 'the redrawn exercise-actions sheet'},
  {name: 'note', spots: ['text'], shows: 'the exercise-note sheet over Focus with a typed note'},
];
export const sceneFile = (scene, lang) => `wt-${scene}-${lang}-dark.webp`;
export const pasteFile = (lang, theme) => `paste-review-${lang}-${theme}.webp`;
export const chartFile = (lang, theme) => `exercise-chart-${lang}-${theme}.webp`;
export const outputFiles = () => [
  ...PROOF_SCENES.flatMap(scene => LANGS.map(lang => sceneFile(scene.name, lang))),
  ...LANGS.flatMap(lang => PASTE_THEMES.map(theme => pasteFile(lang, theme))),
  ...LANGS.flatMap(lang => CHART_THEMES.map(theme => chartFile(lang, theme))),
];

const round2 = value => Number(value.toFixed(2));

/** Compare stored hotspots / counts with a fresh measurement. Returns problem strings; [] means no drift. */
export function compareSpots(stored, measured, tolerance = SPOT_TOLERANCE) {
  if (!stored || typeof stored !== 'object') return ['stored spots are missing or not an object'];
  const problems = [];
  if (stored.schema !== SPOT_SCHEMA) problems.push(`schema ${stored.schema} != ${SPOT_SCHEMA}`);
  for (const key of ['width', 'height', 'scale']) {
    if (stored.frame?.[key] !== measured.frame[key]) problems.push(`frame.${key} ${stored.frame?.[key]} != ${measured.frame[key]}`);
  }
  const storedScenes = stored.scenes || {};
  const storedAny = Object.keys(storedScenes).length > 0 || Object.keys(stored.pasteReview || {}).length > 0;
  if (!storedAny) {
    problems.push('stored spots are empty (placeholder): run --proof <dir> and commit the generated landing-proof-spots.json');
    return problems;
  }
  for (const [scene, spots] of Object.entries(measured.scenes)) {
    if (!storedScenes[scene]) { problems.push(`${scene}: scene not stored`); continue; }
    for (const [id, box] of Object.entries(spots)) {
      const old = storedScenes[scene][id];
      if (!Array.isArray(old) || old.length !== 4) { problems.push(`${scene}.${id}: not stored`); continue; }
      const moved = box.map((value, index) => round2(value - old[index]));
      if (moved.some(delta => Math.abs(delta) > tolerance)) {
        problems.push(`${scene}.${id}: stored [${old}] but live [${box}] (delta [${moved}], tolerance ${tolerance})`);
      }
    }
    for (const id of Object.keys(storedScenes[scene])) {
      if (!(id in spots)) problems.push(`${scene}.${id}: stored but no longer measured`);
    }
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

const fixture = JSON.parse(await readFile(new URL('test/fixtures/landing-proof.json', ROOT), 'utf8'));
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
 * One isolated page. `source` seeds the bench program and marks the landing seen;
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
  const state = structuredClone(seed || fixture);
  state.settings.lang = lang;
  if (lang === 'pt' && !seed) {
    state.programMeta.name = 'Programa de força';
    for (const exercise of state.program) {
      exercise.day = 'Superiores';
      exercise.name = 'Supino reto com barra';
    }
    for (const row of state.log) {
      row.day = 'Superiores';
      row.name = 'Supino reto com barra';
      row.session = '2026-08-28_Superiores_landing';
    }
  }
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

/** Enter the bench session in Focus and prove the recommendation the page will claim. */
async function assertFocus(page, state, name) {
  await page.evaluate(day => window.__repforgeEnterWorkout({focus: true, day}), state.program[0].day);
  await settle(page);
  const load = page.locator('#workout input[data-k="ex-bench_1_load"]');
  const reps = page.locator('#workout input[data-k="ex-bench_1_reps"]');
  assert.equal(Number((await load.inputValue()).replace(',', '.')), 62.5, `${name}: actual Focus next load`);
  assert.equal(Number(await reps.inputValue()), 8, `${name}: actual Focus next reps`);
  // The previous session rides under each matching row as one line: "last 60 x 10 · RIR 2" / "antes 60 x 10 · RIR 2".
  const rows = await page.locator('#workout .exercise.is-current .ledgerline__prev').evaluateAll(lines =>
    lines.map((line, index) => {
      const match = line.textContent.match(/(\d+(?:[.,]\d+)?) \u00d7 (\d+) \u00b7 RIR (\d+)/);
      return match ? [String(index + 1), match[1], match[2], match[3]] : [line.textContent.trim()];
    }));
  assert.deepEqual(rows, [['1', '60', '10', '2'], ['2', '60', '10', '2'], ['3', '60', '10', '2']],
    `${name}: actual last-session ledger`);
  return rows;
}

async function captureSource(browser, output, report) {
  for (const lang of LANGS) for (const theme of ['light', 'dark']) {
    const name = `workout-${lang}-${theme}`;
    const {page, context, state} = await open(browser, {lang, theme, source: true, insets: true});
    try {
      const rows = await assertFocus(page, state, name);
      await page.screenshot({path: `${output}/${name}.png`});
      // The ledger under the cue lists every set of the exercise with its target; each upcoming row shows the same
      // engine answer, read off the live rows (the session list has no per-set inputs since R3c).
      const ledgerRows = page.locator('#workout .exercise.is-current #ledger_ex-bench [data-lrow]');
      assert.equal(await ledgerRows.count(), 3, `${name}: actual upcoming set count`);
      if (values['fault-next']) {
        await ledgerRows.nth(2).locator('[data-lv="load"]').evaluate(cell => {cell.textContent = '99';});
      }
      const upcomingSets = [];
      for (const set of [1, 2, 3]) {
        const row = ledgerRows.nth(set - 1);
        const load = Number((await row.locator('[data-lv="load"]').textContent()).replace(',', '.'));
        const reps = Number(await row.locator('[data-lv="reps"]').textContent());
        assert.equal(load, 62.5, `${name}: actual upcoming set ${set} load`);
        assert.equal(reps, 8, `${name}: actual upcoming set ${set} reps`);
        upcomingSets.push({set, load, reps});
      }
      report.cases.push({name, nextLoad: 62.5, nextReps: 8, upcomingSets, lastSessionRows: rows.length});
      console.log(`PASS ${name}: 3 × 60 kg × 10 @ RIR 2 → all 3 sets at 62.5 kg × 8`);
    } finally {await context.close();}
  }
}

/* ------------------------------------------------------------------ */
/* Proof scenes, hotspots and paste-review                              */
/* ------------------------------------------------------------------ */

/**
 * Runs in the page. Boxes are percentages of the frame: [centre x, centre y, width, height], clipped to
 * what the person can actually see (a scrolling ancestor hides part of a box, and the lens must not
 * magnify pixels that are not on the screen).
 */
function measureInPage({scene, targets, logLabel}) {
  const W = innerWidth, H = innerHeight;
  const pct = (left, top, right, bottom) => [left + (right - left) / 2, top + (bottom - top) / 2, right - left, bottom - top]
    .map((value, index) => +(100 * value / (index % 2 ? H : W)).toFixed(2));
  const visible = (scope, selector) => [...scope.querySelectorAll(selector)].find(e => e.getClientRects().length && e.getBoundingClientRect().width);
  const need = (element, what) => { if (!element) throw new Error(`${scene}: no visible element for ${what}`); return element; };
  // The rectangle [left, top, right, bottom] of `rect` clipped by every clipping ancestor of `element`.
  const clipped = (element, rect) => {
    let [left, top, right, bottom] = [rect.left, rect.top, rect.right, rect.bottom];
    for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
      const box = node.getBoundingClientRect();
      left = Math.max(left, box.left); top = Math.max(top, box.top); right = Math.min(right, box.right); bottom = Math.min(bottom, box.bottom);
    }
    left = Math.max(left, 0); top = Math.max(top, 0); right = Math.min(right, W); bottom = Math.min(bottom, H);
    if (right <= left || bottom <= top) throw new Error(`${scene}: element is not on screen`);
    return [left, top, right, bottom];
  };
  const boxOf = (element, what) => pct(...clipped(need(element, what), element.getBoundingClientRect()));
  if (scene === 'focus') {
    const card = need(visible(document, targets.card), targets.card);
    const head = need(card.querySelector(targets.ledgerHead), targets.ledgerHead).getBoundingClientRect();
    const row = need(card.querySelector(`#workout .exercise.is-current ${targets.ledgerRow}:not(.ledgerline__head)`), targets.ledgerRow);
    const rowBox = row.getBoundingClientRect();
    const log = need(card.querySelector(targets.log), targets.log);
    // The cue is its verdict mark, its headline and the "aim for N reps" line under it; the Why link under them is not part of the read.
    const lines = [...card.querySelectorAll(targets.cueLines)].map(line => line.getBoundingClientRect());
    need(lines.length === 3 ? lines : null, `${targets.card} ${targets.cueLines}`);
    const cueBox = {left: Math.min(...lines.map(r => r.left)), top: Math.min(...lines.map(r => r.top)),
      right: Math.max(...lines.map(r => r.right)), bottom: Math.max(...lines.map(r => r.bottom))};
    return {
      cue: pct(...clipped(card.querySelector('.fx-cue__l1'), cueBox)),
      log: boxOf(log, `${targets.log} (${logLabel})`),
      // From the ledger head through the first row and its last-session line, as far as it is on screen.
      last: pct(...clipped(row, {left: head.left, top: head.top, right: rowBox.right, bottom: rowBox.bottom})),
    };
  }
  if (scene === 'rest') return {dial: boxOf(visible(document, targets.rest), targets.rest)};
  if (scene === 'actions') return {swap: boxOf(visible(document, targets.swap), targets.swap)};
  if (scene === 'note') {
    // The first line of the textarea: its full text column, one line tall.
    const area = need(visible(document, targets.note), targets.note);
    const style = getComputedStyle(area), r = area.getBoundingClientRect();
    const left = r.left + area.clientLeft, top = r.top + area.clientTop + parseFloat(style.paddingTop);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    return {text: pct(...clipped(area, {left, top, right: left + area.clientWidth, bottom: top + line}))};
  }
  throw new Error(`unknown scene ${scene}`);
}

const RUNNERS = {
  focus: async () => {},
  // Log set starts the rest; the clock runs inline in the card's cue slot (R3f), so there is nothing to open.
  rest: async page => {
    await page.locator(`${SPOT_TARGETS.card} ${SPOT_TARGETS.log}`).first().click();
    await page.waitForSelector(`${SPOT_TARGETS.card} ${SPOT_TARGETS.rest}`, {timeout: 20000});
  },
  actions: async page => {
    await page.locator(SPOT_TARGETS.more).click();
    await page.waitForSelector(SPOT_TARGETS.swap, {state: 'visible', timeout: 20000});
    await page.evaluate(() => { const body = document.querySelector('.exactions-sheet__body'); if (body) body.scrollTop = 0; });
  },
  note: async (page, {lang}) => {
    await page.locator(SPOT_TARGETS.more).click();
    await page.locator(SPOT_TARGETS.noteRow).click();
    await page.waitForSelector('#exNoteSheet.is-open', {timeout: 20000});
    await page.fill(SPOT_TARGETS.note, NOTE[lang]);
    await page.evaluate(() => document.activeElement?.blur());
  },
};

/**
 * --fault-retired: put a retired element on screen so a test can prove the retired-UI check bites. The rest scene
 * gets the open rest sheet; the paste-review scene gets the import review's old head.
 */
async function injectRetiredFault(page) {
  await page.evaluate(() => {
    const sheet = document.querySelector('#restSheet');
    if (sheet) { sheet.hidden = false; sheet.classList.remove('hidden'); sheet.style.cssText = 'display:block;width:8px;height:8px'; }
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

async function captureScene(browser, scene, lang, {images}) {
  const name = `${scene}-${lang}`;
  const {page, context, state} = await open(browser, {width: PROOF_FRAME.width, height: PROOF_FRAME.height, dpr: PROOF_FRAME.scale, lang, theme: 'dark',
    source: true, quiet: true, insets: true});
  try {
    await assertFocus(page, state, name);
    const logLabel = (await catalog(lang))['today.log_set'];
    await RUNNERS[scene](page, {lang, logLabel});
    await settle(page);
    const spots = await page.evaluate(measureInPage, {scene, targets: SPOT_TARGETS, logLabel});
    if (values['fault-retired']) await injectRetiredFault(page);
    const retired = await page.evaluate(visibleRetired, RETIRED_SELECTORS);
    assert.deepEqual(retired, [], `${name}: the frame shows retired UI`);
    const webp = images ? await encodeWebp(page, await page.screenshot({type: 'png'})) : null;
    return {spots, webp};
  } finally {await context.close();}
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
    await page.click('#entryOwnToggle');
    await page.click('#entryFreeformStart');
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
  const {page, context} = await open(browser, {width: PROOF_FRAME.width, height: 1300, dpr: PROOF_FRAME.scale, lang, theme,
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
      const clip = await page.evaluate(targets => {
        const top = document.querySelector(targets.head).getBoundingClientRect().top;
        const rows = [...document.querySelectorAll(targets.rows)];
        const bottom = rows.at(-1).getBoundingClientRect().bottom;
        const y = Math.max(0, Math.floor(top) - 16);
        return {x: 0, y, width: innerWidth, height: Math.ceil(bottom) - y + 12};
      }, CHART_TARGETS);
      webp = await encodeWebp(page, await page.screenshot({type: 'png', clip}));
    }
    return {figures: found.model, rows: found.rows, figs: found.figs, pressed: found.pressed, plot: found.plot, webp};
  } finally {await context.close();}
}

/** Run the selected proof scenes. Returns measured spots, counts, and (with images) the WebP buffers by file name. */
export async function runProof(browser, {scenes, images, log = () => {}}) {
  const measured = {schema: SPOT_SCHEMA, frame: {...PROOF_FRAME}, tolerance: SPOT_TOLERANCE, scenes: {}, pasteReview: {}};
  const files = {};
  const review = {};
  for (const scene of PROOF_SCENES.filter(item => scenes.includes(item.name))) {
    const perLang = {};
    for (const lang of LANGS) {
      const result = await captureScene(browser, scene.name, lang, {images});
      perLang[lang] = result.spots;
      if (result.webp) files[sceneFile(scene.name, lang)] = result.webp;
      log(`ok ${scene.name} ${lang} ${JSON.stringify(result.spots)}`);
    }
    assert.deepEqual(Object.keys(perLang.en).sort(), [...scene.spots].sort(), `${scene.name}: measured spots match the scene table`);
    const disagreement = compareSpots({schema: SPOT_SCHEMA, frame: measured.frame, scenes: {[scene.name]: perLang.en}},
      {frame: measured.frame, scenes: {[scene.name]: perLang.pt}});
    assert.deepEqual(disagreement, [], `${scene.name}: hotspots must be identical in EN and PT, they are stored once`);
    measured.scenes[scene.name] = perLang.en;
  }
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
  const allScenes = [...PROOF_SCENES.map(scene => scene.name), PASTE_SCENE, CHART_SCENE];
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
    const scoped = scenes.length === allScenes.length ? stored : {...stored,
      scenes: Object.fromEntries(Object.entries(stored.scenes || {}).filter(([name]) => scenes.includes(name))),
      pasteReview: scenes.includes(PASTE_SCENE) ? stored.pasteReview : {}};
    const problems = compareSpots(scoped, measured);
    if (problems.length) {
      console.error(`FAIL landing proof spots are stale (${file}):\n  ${problems.join('\n  ')}\nRegenerate with: node tools/capture-landing-proof.mjs --proof <dir>`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS landing proof spots match the live DOM (${Object.keys(measured.scenes).length} scenes, ${Object.keys(measured.pasteReview).length} paste-review languages)`);
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
    cases: {type: 'string'}, source: {type: 'string'}, matrix: {type: 'string'}, proof: {type: 'string'}, check: {type: 'boolean'},
    spots: {type: 'string'}, scenes: {type: 'string'}, 'spots-only': {type: 'boolean'},
    'fault-next': {type: 'boolean'}, 'fault-overflow': {type: 'boolean'}, 'fault-retired': {type: 'boolean'},
  }}));
  assert([values.source, values.matrix, values.proof, values.check].filter(Boolean).length === 1,
    'Choose exactly one of --proof <dir>, --check, --source <dir>, --matrix <dir>');
  const browser = await launchChromium();
  try {
    if (values.proof || values.check) {
      await proofMode(browser, {check: Boolean(values.check)});
      return;
    }
    const output = resolve(values.source || values.matrix);
    await mkdir(output, {recursive: true});
    const report = {mode: values.source ? 'source' : 'matrix', cases: []};
    if (values.source) await captureSource(browser, output, report);
    else await captureMatrix(browser, output, report);
    await writeFile(`${output}/proof.json`, `${JSON.stringify(report, null, 2)}\n`);
  } finally {await browser.close();}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
