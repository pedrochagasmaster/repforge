// Captures each mock at 390x844 (2x) in light and dark, then lays the catalog "before" beside it.
// Run: PLAYWRIGHT=<path to playwright-core/index.mjs> flock /tmp/taurifer-browser.lock node docs/design/native-fidelity-mocks/capture.mjs [mock ...]
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = path.resolve(here, "../../ui-screens/screens");
export const MOCKS = {
  hub: "onboarding-start/hub",
  equipment: "onboarding-recommend/equipment",
  "suggest-loads": "program/editor-suggest-loads",
  library: "library/list",
  "history-session": "history/session",
  "schedule-diagnosis": "progress/schedule-diagnosis",
  strength: "progress/strength",
  "transfer-eligible": "install/transfer-eligible",
  "exercise-actions": "workout/exercise-actions",
  "session-details": "workout/session",
};
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright-core");
const only = process.argv.slice(2);
fs.mkdirSync(path.join(here, "after"), { recursive: true });
fs.mkdirSync(path.join(here, "compare"), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [name, shot] of Object.entries(MOCKS)) {
  if (only.length && !only.includes(name)) continue;
  for (const theme of ["light", "dark"]) {
    const after = path.join(here, "after", `${name}-${theme}.png`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pathToFileURL(path.join(here, `${name}.html`)).href + `?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: after });
    const before = path.join(catalog, `${shot}__phone-390-${theme}-en.png`);
    const html = `<body style="margin:0;background:${theme === "dark" ? "#0b0a09" : "#d9d5cd"};font:600 14px system-ui;color:${theme === "dark" ? "#ccc" : "#333"}">
      <div style="display:flex;gap:20px;padding:14px 20px 20px">
      <figure style="margin:0"><figcaption style="padding:0 0 8px">Before · production · ${shot} · ${theme}</figcaption><img src="${pathToFileURL(before).href}" width="390" height="844" style="display:block"></figure>
      <figure style="margin:0"><figcaption style="padding:0 0 8px">After · native UI kit mock</figcaption><img src="${pathToFileURL(after).href}" width="390" height="844" style="display:block"></figure></div></body>`;
    await page.setViewportSize({ width: 840, height: 900 });
    const tmp = path.join(os.tmpdir(), `uikit-compare-${process.pid}.html`);
    fs.writeFileSync(tmp, html);
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
    await page.screenshot({ path: path.join(here, "compare", `${name}-${theme}.png`) });
  }
}
await browser.close();
