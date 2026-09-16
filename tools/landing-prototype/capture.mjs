/**
 * Captures the landing renders' source screenshots from the real app.
 *
 * Two things this does that padding a catalog PNG cannot:
 *  - the app draws its own safe-area insets (env() is rewritten to the real
 *    59/34px), so the shot is full-bleed at the screen's aspect and there is no
 *    dead margin between the UI and the bezel;
 *  - the logged loads are per-exercise and believable.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '../../test/node_modules/playwright/index.mjs';
import { realisticState, WEEK4_LOADS } from './fixture.mjs';

const EMPTY_STATE = {
  settings: realisticState().settings,
  programMeta: {
    id: '', name: '', started: null, created: null, updated: null, onboarded: false,
    mesocycleStatus: 'active', mesocycleLengthWeeks: 6, goal: null, experience: null,
    daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [],
    sessionLength: null, completedAt: null, progressionRelations: [],
    progressionModifiers: [], progressionIncompatibilities: [],
    programStructure: null, entrySource: null,
  },
  program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
};

const BASE = process.env.REPFORGE_URL || 'http://127.0.0.1:8111/';
const OUT = process.env.LANDING_SRC || '/tmp/landing-src';
await mkdir(OUT, { recursive: true });

const sleep = (p, ms) => p.waitForTimeout(ms);

async function open(browser, { theme, lang = 'en', empty = false }) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 3,
    locale: lang === 'pt' ? 'pt-BR' : 'en-US', timezoneId: 'UTC',
    colorScheme: theme, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  // the app's own safe-area expressions, resolved to a real device's insets
  await page.route('**/styles.css', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text())
      .replaceAll('env(safe-area-inset-top)', '59px')
      .replaceAll('env(safe-area-inset-bottom)', '34px') });
  });
  await page.clock.setFixedTime(new Date('2026-08-31T12:00:00Z'));
  const state = empty ? { ...EMPTY_STATE, settings: { ...EMPTY_STATE.settings, lang } } : realisticState(lang);
  await page.addInitScript(({ state, theme, empty }) => {
    localStorage.setItem('repforge_ui_v1', JSON.stringify({ theme, ...(empty ? {} : { entryLandingSeen: true }) }));
    localStorage.setItem('repforge_v1', JSON.stringify(state));
  }, { state, theme, empty });
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__repforgeStorage?.flush === 'function', undefined, { timeout: 30000 });
  await page.evaluate(d => { window.__lpDay = d; }, lang === 'pt' ? 'Dia 1' : 'Day 1');
  await sleep(page, 900);
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

const SCENES = {
  async 'today-ready'(page) { await sleep(page, 400); },

  async 'program-overview'(page) {
    await page.evaluate(() => document.querySelector('nav [data-view="program"]')?.click());
    await sleep(page, 900);
  },

  async focus(page) {
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: window.__lpDay }));
    await sleep(page, 900);
  },

  async 'why-this-weight'(page) {
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: window.__lpDay }));
    await sleep(page, 700);
    // match the i18n key's own element rather than guessing at the label: the
    // PT string is "Por que essa carga?", which a hand-written regex missed and
    // silently captured the focus screen instead of the sheet
    await page.evaluate(() => {
      const el = document.querySelector('#workout [data-i18n="why.open"]')
        || [...document.querySelectorAll('#workout button, #workout a')]
             .find(b => /why this weight|por que essa carga/i.test(b.textContent));
      if (!el) throw new Error('no "why this weight" control found');
      el.click();
    });
    // fail loudly if the sheet never opened, rather than shooting whatever is there
    await page.waitForSelector('#whySheet.is-open, #whySheet[open], #whySheet:not(.hidden)', { timeout: 15000 });
    await sleep(page, 900);
  },

  async 'session-summary'(page) {
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false, day: window.__lpDay }));
    await sleep(page, 700);
    await page.evaluate(loads => {
      for (const [id, load] of Object.entries(loads)) {
        document.querySelectorAll(`#workout [data-k^="${id}_"][data-k$="_load"]`).forEach(el => {
          el.value = String(load); el.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
      // reps/RIR that match how the set actually goes
      document.querySelectorAll('#workout [data-k$="_reps"]').forEach((el, i) => {
        el.value = String([6, 6, 5, 7, 7, 6, 10, 10, 9, 10, 10, 9, 14, 13, 13][i] ?? 8);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.querySelectorAll('#workout [data-k$="_rir"]').forEach((el, i) => {
        el.value = String([1, 1, 0, 1, 1, 0, 2, 1, 1, 2, 1, 1, 2, 1, 1][i] ?? 1);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }, WEEK4_LOADS);
    await sleep(page, 500);
    await page.evaluate(async () => { await window.__repforgeSaveWorkout(); });
    await page.waitForFunction(() => {
      const el = document.querySelector('#sessionSummary');
      return el && !el.hidden && !el.classList.contains('hidden');
    }, undefined, { timeout: 20000 });
    await sleep(page, 1100);
  },

  async 'exercise-chart'(page) {
    await page.evaluate(() => document.querySelector('nav [data-view="stats"]')?.click());
    await sleep(page, 800);
    // the trend chart is driven by the exercise select, not by a segment tab
    await page.evaluate(() => {
      const select = document.querySelector('#statExercise');
      const option = [...(select?.options || [])].find(o => /back squat|agachamento livre/i.test(o.textContent));
      if (option) { select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.evaluate(() => document.querySelector('.chartcard')?.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => {
      const c = document.querySelector('#chart');
      if (!c || !c.width) return false;
      const b = c.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= window.innerHeight;
    }, undefined, { timeout: 20000 });
    await sleep(page, 700);
  },
};

const pick = (page, key, value) => page.click(`[data-entry-pick="${key}"][data-entry-val="${value}"]`);
const next = page => page.click('#onbNext');

/** The five generator questions, exactly as the catalog answers them. */
async function answerGenerator(page) {
  await pick(page, 'desiredResult', 'muscle_growth'); await next(page);
  await pick(page, 'structuredExperience', '6_to_24m');
  await pick(page, 'recentConsistency', 'most'); await next(page);
  await pick(page, 'daysPerWeek', '3');
  await pick(page, 'sessionMinutes', '60');
  await pick(page, 'preferredRestSeconds', '120'); await next(page);
  await pick(page, 'environment', 'commercial_gym'); await next(page);
}

const ENTRY_SCENES = {
  async 'entry-hub'(page) {
    await page.click('#firstRunCreate');
    await page.waitForSelector('#onboarding.active .entry__hub', { timeout: 25000 });
    await sleep(page, 800);
  },
  async 'recommend-result'(page) {
    await page.click('#firstRunCreate');
    await page.waitForSelector('#onboarding.active .entry__hub', { timeout: 25000 });
    await page.click('[data-entry-route="recommend"]');
    await answerGenerator(page);
    await next(page);
    await page.waitForSelector('[data-entry-select-candidate], #entryActivate', { timeout: 40000 });
    await sleep(page, 1100);
  },
};

const browser = await chromium.launch();
const LANGS = (process.env.LANGS || 'en,pt').split(',');
for (const lang of LANGS) for (const theme of ['light', 'dark']) {
  for (const [name, scene] of Object.entries(ENTRY_SCENES)) {
    const { ctx, page } = await open(browser, { theme, lang, empty: true });
    try {
      await scene(page);
      const file = `${name}-${lang}-${theme}`;
      await shot(page, file);
      console.log(`✓ ${file}`);
    } catch (e) {
      console.log(`✗ ${name} ${lang}/${theme}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
for (const lang of LANGS) for (const theme of ['light', 'dark']) {
  for (const [name, scene] of Object.entries(SCENES)) {
    const { ctx, page } = await open(browser, { theme, lang });
    try {
      await scene(page);
      const file = `${name}-${lang}-${theme}`;
      await shot(page, file);
      console.log(`✓ ${file}`);
    } catch (e) {
      console.log(`✗ ${name} ${lang}/${theme}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
