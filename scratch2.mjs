import { test } from 'node:test';
import { chromium } from './test/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err));
await page.goto('http://127.0.0.1:8060/index.html');
await page.waitForLoadState('networkidle');

const res = await page.evaluate(async () => {
    const transfer = window.RepForgeInstallTransfer;
    const contract = window.RepForgeInstallTransferContract;
    const credentials = transfer?.createCredentialVault?.({ crypto: window.crypto, indexedDB: window.indexedDB });
    const cookieValues = new Map();
    const cookieDocument = {
      get cookie() { return [...cookieValues].map(([name, cookieValue]) => `${name}=${cookieValue}`).join("; "); },
      set cookie(serialized) {
        const [pair, ...attributes] = String(serialized).split(";");
        const separator = pair.indexOf("=");
        if (separator < 0) return;
        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1).trim();
        const maxAge = attributes.find((attribute) => /^\s*Max-Age=/i.test(attribute));
        if (maxAge && /Max-Age=0(?:\s|$)/i.test(maxAge)) cookieValues.delete(name);
        else cookieValues.set(name, cookieValue);
      },
    };
    const cookieLocation = { href: `${location.origin}/index.html`, origin: location.origin, pathname: "/index.html" };
    
    // Simulate what importInto does:
    const token = "v1.k1.aaa.aaa.aaa";
    const expiresAt = "2099-01-01T00:00:00.000Z";
    
    if (!transfer) return {reason: "!transfer"};
    if (!contract) return {reason: "!contract"};
    if (!credentials) return {reason: "!credentials"};
    
    const wrote = transfer.writeTransferCookie({ token, expiresAt }, { document: cookieDocument, location: cookieLocation });
    if (!wrote) return {reason: "!wroteTransferCookie", document: cookieDocument, location: cookieLocation};
    
    return { ok: true };
});
console.log('Setup result:', res);
await browser.close();
