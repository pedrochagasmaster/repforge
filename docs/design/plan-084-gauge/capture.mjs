// Capture disposable design fixtures only. Run this entire process under flock.
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../../../test/package.json', import.meta.url));
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'gauge-084-'));
const browser = await chromium.launch({ headless: true });
const cells = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const scenes = [
    ['Today · fresh', 'today', 'fresh', ''],
    ['Today · mid-way', 'today', 'mid', ''],
    ['Today · well-tailored', 'today', 'full', ''],
    ['Overview · mid-way', 'overview', 'mid', ''],
    ['Finish · previous reading', 'finish', 'mid', 'before'],
    ['Finish · after save', 'finish', 'mid', ''],
  ];
  for (const variant of ['A','B','C']) {
    for (const lang of ['pt','en']) for (const theme of ['light','dark']) {
      for (const [label, screen, stage, freeze] of scenes) {
        const url = new URL('index.html', import.meta.url);
        url.search = new URLSearchParams({ variant, lang, theme, screen, stage, capture:'1', freeze }).toString();
        await page.goto(url.href);
        await page.evaluate(() => document.fonts.ready);
        if (screen === 'finish' && !freeze) await page.waitForFunction(() => document.querySelector('#phone').dataset.saved === 'after');
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => { animation.finish(); return animation.finished; })));
        const file = join(scratch, `${variant}-${lang}-${theme}-${screen}-${stage}-${freeze || 'after'}.png`);
        await page.screenshot({ path: file });
        cells.push({ variant, lang, theme, label, file });
      }
    }
  }
} finally { await browser.close(); }
await writeFile(join(scratch,'cells.json'), JSON.stringify(cells));
execFileSync('python3', [join(here,'contact-sheets.py'), join(scratch,'cells.json'), here], { stdio: 'inherit' });
console.log(`72 source frames retained in ${scratch}. Three 390px contact sheets written beside the prototype.`);
