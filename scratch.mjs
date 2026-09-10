import { test } from 'node:test';
import { chromium } from './test/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err));
await page.goto('http://127.0.0.1:8060/index.html');
await page.waitForLoadState('networkidle');
const res = await page.evaluate(() => {
  return typeof window.RepForgeInstallTransfer;
});
console.log('transfer type:', res);
await browser.close();
