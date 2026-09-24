/* §7.6 captures: every D-family screen at 360/390/430 × PT/EN × light/dark.

     REVIEW_URL=http://localhost:8000/docs/design/main-screen-directions/ \
       node docs/design/main-screen-directions/checks/capture.mjs [outDir]

   The full matrix (4 directions × 17 screens × 12 variants) goes to outDir
   (default /tmp/main-screen-captures) and is not committed. The PT 390 light
   captures of Today, focus, Why, rest and summary, the landing-page shots
   (§8), are also written to ../captures/ for the PR. */
import { createRequire } from "module";
import { mkdirSync } from "fs";

const here = new URL(".", import.meta.url);
const require = createRequire(new URL("../../../../test/package.json", import.meta.url));
const { chromium } = require("playwright");

const BASE = process.env.REVIEW_URL || "http://localhost:8000/docs/design/main-screen-directions/";
const OUT = process.argv[2] || "/tmp/main-screen-captures";
const DIRS = (process.env.DIRS || "d,e,f,g").split(",");
const SCREENS = ["today", "workout", "why", "rest", "why-set2", "summary", "summary2", "progress", "chart", "history", "session", "program",
  "today-mixed", "why-repgoal", "why-anchor", "why-manual", "summary-first"];
const LANDING = ["today", "workout", "why", "rest", "summary"];
const attach = new URL("../captures/", here).pathname;
mkdirSync(OUT, { recursive: true });
mkdirSync(attach, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1100 }, deviceScaleFactor: 2 });
let n = 0;
for (const w of [360, 390, 430]) for (const lang of ["pt", "en"]) for (const theme of ["light", "dark"]) {
  await page.goto(BASE);
  await page.evaluate(([lang, theme, w]) => {
    localStorage.setItem("taurifer-directions:lang", lang); localStorage.setItem("taurifer-directions:theme", theme);
    localStorage.setItem("taurifer-directions:w", String(w)); localStorage.setItem("taurifer-directions:view", "one");
  }, [lang, theme, w]);
  for (const dir of DIRS) for (const screen of SCREENS) {
    await page.goto(`${BASE}#${dir}-${screen}`);
    await page.reload();
    await page.waitForSelector('.ph[data-phone="main"]');
    await page.evaluate(() => { window.UI.running = false; document.querySelectorAll(".device").forEach((d) => { d.style.transform = "none"; }); });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    const ph = page.locator('.ph[data-phone="main"]');
    const name = `${dir}-${screen}__${w}-${theme}-${lang}.png`;
    await ph.screenshot({ path: `${OUT}/${name}` });
    if (w === 390 && lang === "pt" && theme === "light" && LANDING.includes(screen)) await ph.screenshot({ path: `${attach}${dir}-${screen}.png` });
    n++;
  }
}
await browser.close();
console.log(`${n} captures in ${OUT}; landing shots in ${attach}`);
