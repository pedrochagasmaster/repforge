import { chromium } from '../../test/node_modules/playwright/index.mjs';

const URL = process.env.LANDING_URL || 'http://127.0.0.1:8103/';
const OUT = process.env.LANDING_SHOTS || '/tmp/landing-audit';
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const fails = [];

async function page(opts) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, ...opts });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.locator('.firstrun:not(.hidden),.lp').first().waitFor();
  await p.evaluate(async () => {
    for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager';
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  return { ctx, p };
}

// --- 200% text (root font-size doubled, the reflow contract) ---
for (const w of [320, 390]) {
  const { ctx, p } = await page({ viewport: { width: w, height: 844 } });
  await p.addStyleTag({ content: 'html{font-size:32px}' });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped: [...document.querySelectorAll('.lp-cta,.lp-beat__title,.lp-pull__value,.lp-facts li,.firstrun__cta,.firstrun-beat__title,.firstrun-pull__value,.firstrun-facts li')]
      .filter(e => e.scrollWidth > e.clientWidth + 1)
      .map(e => (e.className || e.tagName) + ' :: ' + e.textContent.trim().slice(0, 40)),
  }));
  if (r.overflow > 0) fails.push(`200% @${w}: horizontal overflow ${r.overflow}px`);
  for (const c of r.clipped) fails.push(`200% @${w}: clipped ${c}`);
  await p.screenshot({ path: `${OUT}/${w}-text200.png`, fullPage: true });
  console.log(`200% @${w}: overflow=${r.overflow} clipped=${r.clipped.length}`);
  await ctx.close();
}

// --- forced colors ---
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 }, forcedColors: 'active' });
  await p.screenshot({ path: `${OUT}/390-forced.png`, fullPage: true });
  console.log('forced-colors captured');
  await ctx.close();
}

// --- keyboard focus: every interactive element reachable and visibly ringed ---
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 } });
  const n = await p.evaluate(() => {
    const root = document.querySelector('.firstrun:not(.hidden),.lp');
    const controls = [...root.querySelectorAll('button,a[href],select,input,textarea')]
      .filter(control => control.getClientRects().length && !control.disabled);
    controls.forEach((control, index) => control.dataset.auditFocus = String(index));
    return controls.length;
  });
  const seen = new Map();
  for (let i = 0; i < n + 1; i++) {
    await p.keyboard.press('Tab');
    const cur = await p.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || !('auditFocus' in a.dataset)) return null;
      const s = getComputedStyle(a);
      return { id: a.dataset.auditFocus, tag: a.tagName, label: a.textContent.trim().slice(0, 30), outline: s.outlineWidth, style: s.outlineStyle };
    });
    if (cur) seen.set(cur.id, cur);
  }
  const reached = [...seen.values()];
  const unringed = reached.filter(s => s.outline === '0px' || s.style === 'none');
  if (reached.length < n) fails.push(`keyboard: only ${reached.length}/${n} controls reachable`);
  for (const u of unringed) fails.push(`keyboard: no focus ring on "${u.label}"`);
  console.log(`keyboard: ${reached.length}/${n} controls focusable, ${unringed.length} without a ring`);
  await ctx.close();
}

// --- heading order + alt text ---
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 } });
  const r = await p.evaluate(() => ({
    ...(() => {
      const root = document.querySelector('.firstrun:not(.hidden),.lp');
      const images = [...root.querySelectorAll('img')];
      return {
        headings: [...root.querySelectorAll('h1,h2,h3')].map(h => h.tagName),
        missingAlt: images.filter(i => !i.hasAttribute('alt')).length,
        emptyAlt: images.filter(i => i.alt === '').map(i => i.src.split('/').pop()),
        h1: root.querySelectorAll('h1').length,
      };
    })(),
  }));
  if (r.h1 !== 1) fails.push(`headings: ${r.h1} h1 elements (want exactly 1)`);
  if (r.missingAlt) fails.push(`images: ${r.missingAlt} without an alt attribute`);
  console.log(`headings: ${r.headings.join(',')} | decorative alt="": ${r.emptyAlt.join(',')}`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (fails.length ? 'FAILURES:\n- ' + fails.join('\n- ') : 'no failures'));
if (fails.length) process.exitCode = 1;
