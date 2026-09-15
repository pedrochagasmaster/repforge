import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {launchChromium, waitForAppBoot} from '../test/browser.mjs';
import {MINIMAL_PAYLOAD, BUILT_IN_IDS} from '../test/fixtures/shared-setup.mjs';
import {settle} from './ui-screens/session.mjs';

const {values} = parseArgs({options: {
  source: {type: 'string'}, matrix: {type: 'string'}, 'fault-next': {type: 'boolean'}, 'fault-overflow': {type: 'boolean'},
}});
assert(Boolean(values.source) !== Boolean(values.matrix), 'Choose --source outputdir or --matrix outputdir');
const output = resolve(values.source || values.matrix);
const base = process.env.REPFORGE_URL || 'http://localhost:8000/';
const fixture = JSON.parse(await readFile(new URL('../test/fixtures/landing-proof.json', import.meta.url), 'utf8'));
await mkdir(output, {recursive: true});
const report = {mode: values.source ? 'source' : 'matrix', cases: []};

async function safeInsets(page) {
  await page.route('**/styles.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: (await response.text())
      .replaceAll('env(safe-area-inset-top)', '59px')
      .replaceAll('env(safe-area-inset-bottom)', '34px')});
  });
}

async function open(browser, {width = 430, height = 932, lang = 'en', theme = 'light', scale = 1,
  source = false, insets = false, forcedColors = 'none', reducedMotion = 'reduce'}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: source ? 3 : 1,
    locale: lang === 'pt' ? 'pt-BR' : 'en-US', timezoneId: 'UTC', colorScheme: theme,
    serviceWorkers: 'block', reducedMotion, forcedColors});
  const page = await context.newPage();
  if (insets) await safeInsets(page);
  await page.clock.setFixedTime(new Date('2026-08-31T12:00:00Z'));
  const state = structuredClone(fixture);
  state.settings.lang = lang;
  if (lang === 'pt') {
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
  await page.addInitScript(({state, lang, theme, source, scale}) => {
    if (!sessionStorage.getItem('landing-proof-seeded')) {
      localStorage.setItem('repforge_ui_v1', JSON.stringify({theme, ...(source ? {entryLandingSeen: true} : {})}));
      if (source) localStorage.setItem('repforge_v1', JSON.stringify(state));
      sessionStorage.setItem('landing-proof-seeded', '1');
    }
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = `${scale * 100}%`;
    }, {once: true});
  }, {state, lang, theme, source, scale});
  await page.goto(base);
  await waitForAppBoot(page, {base});
  return {page, context, state};
}

async function captureSource(browser) {
  for (const lang of ['en', 'pt']) for (const theme of ['light', 'dark']) {
    const name = `workout-${lang}-${theme}`;
    const {page, context, state} = await open(browser, {lang, theme, source: true, insets: true});
    try {
      await page.evaluate(day => window.__repforgeEnterWorkout({focus: true, day}), state.program[0].day);
      await settle(page);
      const load = page.locator('#workout input[data-k="ex-bench_1_load"]');
      const reps = page.locator('#workout input[data-k="ex-bench_1_reps"]');
      assert.equal(Number((await load.inputValue()).replace(',', '.')), 62.5, `${name}: actual Focus next load`);
      assert.equal(Number(await reps.inputValue()), 8, `${name}: actual Focus next reps`);
      const rows = await page.locator('#workout .ledger__row.is-past').evaluateAll(elements =>
        elements.map(row => [...row.children].map(cell => cell.textContent.trim())));
      assert.deepEqual(rows, [['1', '60', '10', '2'], ['2', '60', '10', '2'], ['3', '60', '10', '2']],
        `${name}: actual last-session ledger`);
      await page.screenshot({path: `${output}/${name}.png`});
      await page.evaluate(day => window.__repforgeEnterWorkout({focus: false, day}), state.program[0].day);
      await settle(page);
      const upcomingLoads = page.locator('#workout input[data-k^="ex-bench_"][data-k$="_load"]');
      assert.equal(await upcomingLoads.count(), 3, `${name}: actual upcoming set count`);
      if (values['fault-next']) {
        await page.locator('#workout input[data-k="ex-bench_3_load"]').evaluate(input => {input.value = '99';});
      }
      const upcomingSets = [];
      for (const set of [1, 2, 3]) {
        const loadValue = await page.locator(`#workout input[data-k="ex-bench_${set}_load"]`).inputValue();
        const repsValue = await page.locator(`#workout input[data-k="ex-bench_${set}_reps"]`).inputValue();
        const load = Number(loadValue.replace(',', '.'));
        const reps = Number(repsValue);
        assert.equal(load, 62.5, `${name}: actual upcoming set ${set} load`);
        assert.equal(reps, 8, `${name}: actual upcoming set ${set} reps`);
        upcomingSets.push({set, load, reps});
      }
      report.cases.push({name, nextLoad: 62.5, nextReps: 8, upcomingSets, lastSessionRows: rows.length});
      console.log(`PASS ${name}: 3 × 60 kg × 10 @ RIR 2 → all 3 sets at 62.5 kg × 8`);
    } finally {await context.close();}
  }
}

const matrix = [
  ...[320, 360, 390, 430, 768].map(width => ({name: `${width}-en`, width})),
  {name: '390-pt', lang: 'pt'}, {name: '390-dark', theme: 'dark'},
  {name: '390-pt-dark', lang: 'pt', theme: 'dark'},
  {name: '390-text200', scale: 2}, {name: '390-pt-text200', lang: 'pt', scale: 2},
  {name: '390-shared', route: 'shared'}, {name: '390-shared-pt', route: 'shared', lang: 'pt'},
  {name: '390-invalid', route: 'invalid'}, {name: '390-reduced', reducedMotion: 'reduce'},
  {name: '390-forced-colors', forcedColors: 'active'}, {name: '390-safe-insets', insets: true},
];

async function assertLanding(page, name, lang, theme) {
  const target = page.locator('.firstrun-proof__next strong');
  if (values['fault-next']) await target.evaluate(node => {node.textContent = '99';});
  assert.equal(Number((await target.innerText()).replace(',', '.')), 62.5, `${name}: live next-session target`);
  assert.match(await page.locator('.firstrun-proof__reps').innerText(), /3\D+8/, `${name}: next-session sets and reps`);
  const image = page.locator('#landingDevice');
  assert.equal(await image.getAttribute('src'), `assets/brand/landing-workout-${lang}-${theme}.webp`, `${name}: localized device image`);
  assert(await image.evaluate(node => node.complete && node.naturalWidth > 0), `${name}: device image loaded`);
  if (values['fault-overflow']) await page.locator('.firstrun-proof__result').evaluate(node => {node.style.width = '200vw';});
  const geometry = await page.evaluate(() => {
    const root = document.documentElement, landing = document.querySelector('#firstRun');
    return {document: root.scrollWidth - root.clientWidth, landing: landing.scrollWidth - landing.clientWidth};
  });
  assert(geometry.document <= 1 && geometry.landing <= 1, `${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  const controls = page.locator('#firstRun button:visible, #firstRun a[href]:visible, #firstRun select:visible');
  const count = await controls.count();
  assert(count > 0, `${name}: landing has controls`);
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    await control.scrollIntoViewIfNeeded();
    await control.click({trial: true});
    const box = await control.boundingBox();
    const viewport = page.viewportSize();
    assert(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1,
      `${name}: control ${index + 1} fits after scrolling`);
  }
  await page.locator('#firstRun').evaluate(node => {node.scrollTop = 0;});
  await settle(page);
  return {controls: count, overflow: geometry};
}

async function captureMatrix(browser) {
  for (const item of matrix) {
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
      const checks = await assertLanding(page, item.name, config.lang, config.theme);
      await page.screenshot({path: `${output}/${item.name}.png`});
      const fullHeight = await page.locator('.firstrun__inner').evaluate(node => Math.ceil(node.getBoundingClientRect().height) + 80);
      await page.setViewportSize({width: config.width, height: Math.max(config.height, fullHeight)});
      await settle(page);
      await page.screenshot({path: `${output}/${item.name}-full.png`});
      report.cases.push({name: item.name, ...checks});
      console.log(`PASS ${item.name}: next 62.5 kg; ${checks.controls} reachable controls; no horizontal overflow`);
    } finally {await context.close();}
  }
}

const browser = await launchChromium();
try {
  if (values.source) await captureSource(browser);
  else await captureMatrix(browser);
  await writeFile(`${output}/proof.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {await browser.close();}
