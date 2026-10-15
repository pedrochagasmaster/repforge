// Captures the comparison-board frames from the live prototypes (390 px, 2x).
//   flock /tmp/taurifer-browser.lock node docs/design/onboarding-mf/prototype/capture.mjs [base-url]
// Needs a static server at the repository root (default http://127.0.0.1:8770)
// and the test-only Playwright install (cd test && npm ci).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, "../../../../test/package.json"));
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://127.0.0.1:8770") + "/docs/design/onboarding-mf/prototype/app.html";
const FLOWS = {
  a: ["hub", "intro", "sex", "birth", "height", "weight", "lifting", "cardio", "gym", "equipment", "goal", "days", "minutes", "priorities", "deload", "competency", "result"],
  b: ["hub", "intro", "sex", "birth", "height", "weight", "lifting", "cardio", "gym", "equipment", "goal", "days", "minutes", "priorities", "deload", "competency", "result"],
  c: ["hub", "about", "experience", "gym", "program", "focus", "competency", "result"],
};
const out = path.join(here, "shots");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [c, steps] of Object.entries(FLOWS)) {
  const theme = c === "a" ? "dark" : "light";
  const jobs = steps.map((s) => [s, "pt", theme]).concat([["result", "en", theme], ["competency", "pt", c === "a" ? "light" : "dark"], ["result", "pt", c === "a" ? "light" : "dark"]]);
  for (const [s, lang, th] of jobs) {
    await page.goto(`${base}?c=${c}&lang=${lang}&theme=${th}&rm=1&demo=1&step=${s}`);
    if (s === "result") await page.waitForFunction(() => document.querySelector(".page.current")?.dataset.step === "result", null, { timeout: 60000 });
    if (s === "gym" && c === "c") { await page.waitForTimeout(300); await page.locator(".page.current [data-act=disc]").click(); }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${c}-${s}.${lang}.${th}.png`) });
  }
  console.log(c, jobs.length);
}
await browser.close();
