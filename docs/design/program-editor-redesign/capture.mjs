// Captures every candidate frame at 390 px, 2x, light and dark (PT), plus EN for
// the two densest screens of each candidate, and writes the string inventory.
//   python3 -m http.server 8791 &   (from the repository root)
//   flock /tmp/taurifer-browser.lock node docs/design/program-editor-redesign/capture.mjs [base-url]
// Needs the test-only Playwright install (cd test && npm ci).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, "../../../test/package.json"));
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://127.0.0.1:8791") + "/docs/design/program-editor-redesign";
const EN = { a: ["a2-exercise", "a4-weeks"], b: ["b3-exercise", "b4-exceptions"], c: ["c1-overview", "c4-exceptions"] };
const strings = {};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
for (const c of Object.keys(EN)) {
  const dir = path.join(here, `candidate-${c}`, "png");
  fs.mkdirSync(dir, { recursive: true });
  const jobs = [["pt", "light"], ["pt", "dark"], ["en", "light"], ["en", "dark"]];
  for (const [lang, theme] of jobs) {
    await page.goto(`${base}/candidate-${c}/index.html?lang=${lang}&theme=${theme}`);
    await page.waitForSelector("body[data-ready=true]");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    if (lang === "pt" && theme === "light") strings[c] = await page.evaluate(() => ({ added: window.__newStrings, existing: window.__existing }));
    const ids = await page.$$eval(".phone", els => els.map(e => e.id));
    for (const id of ids) {
      if (lang === "en" && !EN[c].includes(id)) continue;
      await page.locator(`#${id}`).screenshot({ path: path.join(dir, `${id}.${lang}.${theme}.png`) });
    }
  }
  console.log(c, "done");
}
fs.writeFileSync(path.join(here, "strings.json"), JSON.stringify(strings, null, 2) + "\n");
await browser.close();
