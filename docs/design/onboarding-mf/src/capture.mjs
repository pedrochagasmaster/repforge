// Captures every candidate frame to PNG at 390 px, 2x.
//   flock /tmp/taurifer-browser.lock node docs/design/onboarding-mf/src/capture.mjs
// Uses the test-only Playwright install under test/ (cd test && npm ci).
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "test/package.json"));
const { chromium } = require("playwright");

const CANDS = { a: "a-faithful", b: "b-identity", c: "c-compressed" };
const only = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

for (const [key, dir] of Object.entries(CANDS)) {
  if (only && only !== key) continue;
  const base = pathToFileURL(path.join(here, "..", dir, "index.html")).href;
  await page.goto(base);
  const flow = await page.evaluate(() => window.FLOWS[document.documentElement.dataset.cand].map((s) => ({ id: s.id, en: !!s.en })));
  const out = path.join(here, "..", dir, "png");
  fs.mkdirSync(out, { recursive: true });
  for (const s of flow) {
    const variants = [["pt", "light"], ["pt", "dark"]];
    if (s.en) variants.push(["en", "light"], ["en", "dark"]);
    for (const [lang, theme] of variants) {
      await page.goto(`${base}?screen=${s.id}&lang=${lang}&theme=${theme}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".phone").screenshot({ path: path.join(out, `${s.id}.${lang}.${theme}.png`) });
    }
  }
  console.log(dir, flow.length, "screens");
}
await browser.close();
