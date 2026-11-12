// Capture disposable design fixtures only. Run this entire process under flock.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, access } from 'node:fs/promises';
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
const reuseAt=process.argv.indexOf('--reuse');
const reused=reuseAt>=0?JSON.parse(await readFile(process.argv[reuseAt+1],'utf8')):[];
const unchanged=new Set(['today:fresh','lift:mid']);
let renderedCount=0;

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const scenes = [
    ['Today · fresh', 'today', 'fresh', ''],
    ['Today · mid-way', 'today', 'mid', ''],
    ['Today · well-tailored', 'today', 'full', ''],
    ['Overview · mid-way', 'overview', 'mid', ''],
    ['Per-lift stages', 'lift', 'mid', ''],
    ['Finish · previous reading', 'finish', 'mid', 'before'],
    ['Finish · after save', 'finish', 'mid', ''],
    ['Scope · 4 to 6 lifts', 'scope', 'mid', ''],
  ];
  {
    for (const lang of ['pt','en']) for (const theme of ['light','dark']) {
      for (const [label, screen, stage, freeze] of scenes) {
        if(reuseAt>=0 && unchanged.has(`${screen}:${stage}`)){
          const previous=reused.find(cell=>cell.lang===lang&&cell.theme===theme&&cell.label===label);
          if(!previous)throw new Error(`Missing retained frame: ${lang}/${theme}/${label}`);
          await access(previous.file);
          cells.push({...previous,source:'retained-round-2'});
          continue;
        }
        const url = new URL('index.html', import.meta.url);
        url.search = new URLSearchParams({ lang, theme, screen, stage, capture:'1', freeze }).toString();
        await page.goto(url.href);
        await page.evaluate(() => document.fonts.ready);
        if (screen === 'finish' && !freeze) await page.waitForFunction(() => document.querySelector('#phone').dataset.saved === 'after');
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => { animation.finish(); return animation.finished; })));
        const file = join(scratch, `${lang}-${theme}-${screen}-${stage}-${freeze || 'after'}.png`);
        await page.screenshot({ path: file });
        cells.push({ lang, theme, label, file, source:'rendered-round-3' });
        renderedCount++;
      }
    }
  }
} finally { await browser.close(); }
await writeFile(join(scratch,'cells.json'), JSON.stringify(cells));
const record={round:3,rendered:renderedCount,retained:cells.length-renderedCount,layout:'8 columns x 4 rows, 390x844 per cell',retainedFromHead:reuseAt>=0?'dac9c6c73e874da97ba7c0c4daa00015e127aa87':null,cells:await Promise.all(cells.map(async cell=>({language:cell.lang,theme:cell.theme,label:cell.label,source:cell.source,sha256:createHash('sha256').update(await readFile(cell.file)).digest('hex')})))};
await writeFile(join(here,'capture-record.json'),JSON.stringify(record,null,2)+'\n');
execFileSync('python3', [join(here,'contact-sheets.py'), join(scratch,'cells.json'), here], { stdio: 'inherit' });
console.log(`${renderedCount} frames rendered; ${cells.length-renderedCount} retained unchanged. Manifest: ${scratch}/cells.json. One contact sheet assembled in the existing layout.`);
