import { chromium } from '../../test/node_modules/playwright/index.mjs';
const b = await chromium.launch();
let failed = false;
for (const w of [320, 390, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(process.env.LANDING_URL || 'http://127.0.0.1:8103/', { waitUntil: 'networkidle' });
  await p.locator('.firstrun:not(.hidden),.lp').first().waitFor();
  await p.evaluate(async () => {
    for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager';
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  const r = await p.evaluate(() => {
    const stage = document.querySelector('.firstrun-stage--pair,.lp-stage--pair');
    const s = stage.getBoundingClientRect();
    const box = sel => {
      const el = [...stage.querySelectorAll(sel)].find(n => getComputedStyle(n).display !== 'none');
      const b = el.getBoundingClientRect();
      return { l: b.left - s.left, t: b.top - s.top, r: b.right - s.left, b: b.bottom - s.top };
    };
    const back = box('.lp-stage__back,.firstrun-stage__back');
    const front = box('.lp-stage__front,.firstrun-stage__front');
    const clip = o => ({
      top: Math.max(0, -o.t).toFixed(1), left: Math.max(0, -o.l).toFixed(1),
      right: Math.max(0, o.r - s.width).toFixed(1), bottom: Math.max(0, o.b - s.height).toFixed(1),
    });
    const overlapX = Math.max(0, Math.min(back.r, front.r) - Math.max(back.l, front.l));
    return {
      stage: { w: +s.width.toFixed(1), h: +s.height.toFixed(1) },
      backClip: clip(back), frontClip: clip(front),
      overlapPctOfBack: +(100 * overlapX / (back.r - back.l)).toFixed(0),
    };
  });
  const clipped = [...Object.values(r.backClip), ...Object.values(r.frontClip)].some(v => +v > 0.5);
  if (clipped || Math.abs(r.overlapPctOfBack - 24) > 1) failed = true;
  console.log(`${String(w).padStart(4)}px stage ${r.stage.w}x${r.stage.h}  overlap ${r.overlapPctOfBack}% of back  ${clipped ? 'CLIPPED ' + JSON.stringify({back:r.backClip,front:r.frontClip}) : 'no clipping'}`);
  await ctx.close();
}
await b.close();
if (failed) process.exitCode = 1;
