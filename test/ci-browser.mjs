/** Exercise real diagnostic output without making the suite itself flaky. */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { launchChromium, assertServingApp } from "./browser.mjs";
import { instrumentBrowser } from "./browser-artifacts.mjs";

const directory = mkdtempSync(join(tmpdir(), "taurifer-diagnostics-"));
const browser = await launchChromium();
try {
  instrumentBrowser(browser, directory);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent("<h1>Diagnostic fixture</h1>");
  await page.evaluate(() => console.error("synthetic diagnostic error"));
  assert.throws(() => assert.equal(1, 2), /Expected values/);
  await context.close();
  const files = readdirSync(directory, { recursive: true });
  assert.ok(files.some((name) => name.endsWith("trace.zip")), "trace survives context close");
  assert.ok(files.some((name) => name.endsWith("page-1.png")), "screenshot survives context close");
  const events = files.find((name) => name.endsWith("events.json"));
  assert.match(readFileSync(join(directory, events), "utf8"), /synthetic diagnostic error/);
} finally {
  await browser.close();
  rmSync(directory, { recursive: true, force: true });
}
const server = createServer((request, response) => { response.writeHead(404); response.end("wrong root"); });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/`;
  await assert.rejects(assertServingApp(base), /HTTP 404/);
  await assert.rejects(assertServingApp(base), /HTTP 404/, "cached failures must still throw");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log("Browser diagnostics and cached boot-error self-tests passed.");
