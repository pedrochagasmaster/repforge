#!/usr/bin/env node
/**
 * Real-browser evidence for the client credential boundary.
 *
 * This suite deliberately loads only the exported install-transfer client and
 * uses the existing app shell as an origin for real IndexedDB and cookie
 * behavior. It does not load the unpublished shared transfer contract, so it
 * proves vault/cookie behavior while keeping client status parity pending.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8055/";
const ORIGIN = new URL(BASE);
const INDEX_URL = new URL("index.html?install-transfer-client-browser=1", ORIGIN).href;
const EXPECTATIONS = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-client/browser-expectations.json"), "utf8"));
const ARTIFACT_DIR = process.env.REPFORGE_ARTIFACT_DIR || "/tmp/plan053-p3";
const startedAt = new Date().toISOString();
const reportPath = join(ARTIFACT_DIR, "install-transfer-client-browser.json");

const checks = [];
function check(condition, message) {
  assert.ok(condition, message);
  checks.push(message);
}

async function writeReport(extra = {}) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    testPid: process.pid,
    serverPid: process.env.REPFORGE_SERVER_PID ? Number(process.env.REPFORGE_SERVER_PID) : null,
    origin: ORIGIN.origin,
    startedAt,
    finishedAt: new Date().toISOString(),
    assertions: checks.length,
    ...extra,
  }, null, 2));
}

async function assertOrigin() {
  const response = await fetch(INDEX_URL, { redirect: "error" });
  if (!response.ok) throw new Error(`origin unavailable: HTTP ${response.status}`);
  await response.arrayBuffer();
}

function moduleUrl() {
  return new URL("install-transfer.js", ORIGIN).href;
}

async function openBrowserClient(page) {
  await page.goto(INDEX_URL, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ url: moduleUrl() });
  await page.waitForFunction(() => typeof window.RepForgeInstallTransfer?.createCredentialVault === "function");
}

async function main() {
  await assertOrigin();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const token = "browser-vault-token-" + "x".repeat(32);
  let sealed;
  try {
    await context.clearCookies();
    await openBrowserClient(page);
    await page.evaluate(async (dbName) => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = request.onblocked = request.onerror = () => resolve();
      });
      localStorage.clear();
      sessionStorage.clear();
    }, EXPECTATIONS.credentialDatabase.name);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.addScriptTag({ url: moduleUrl() });

    const first = await page.evaluate(async ({ token, expected }) => {
      const transfer = window.RepForgeInstallTransfer;
      const vault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      const sealed = await vault.seal("browser-outbound", { token, claimId: "browser-claim-id" });
      const getRawKey = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(expected.credentialDatabase.name);
        request.onerror = () => reject(request.error || new Error("credential-db-open-failed"));
        request.onsuccess = () => {
          const database = request.result;
          const read = database.transaction(expected.credentialDatabase.store, "readonly").objectStore(expected.credentialDatabase.store).get(`${expected.credentialDatabase.keyNamePrefix}${sealed.keyId}`);
          read.onerror = () => reject(read.error || new Error("credential-key-read-failed"));
          read.onsuccess = () => { resolve(read.result || null); database.close(); };
        };
      });
      const decode = (value) => {
        const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
        return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
      };
      const rawKey = await getRawKey();
      const unsealed = await vault.unseal("browser-outbound", sealed);
      let exportRejected = false;
      try { await globalThis.crypto.subtle.exportKey("raw", rawKey); }
      catch { exportRejected = true; }
      const probe = {
        sealedVersion: sealed.version,
        algorithm: sealed.algorithm,
        ivBytes: decode(sealed.iv).byteLength,
        rawKeyIsCryptoKey: rawKey instanceof CryptoKey,
        rawKeyExtractable: rawKey?.extractable,
        rawKeyAlgorithm: rawKey?.algorithm?.name,
        rawKeyLength: rawKey?.algorithm?.length,
        rawKeyUsages: [...(rawKey?.usages || [])].sort(),
        exportRejected,
        unsealedMatches: unsealed?.token === token && unsealed?.claimId === "browser-claim-id",
        sealedHasToken: JSON.stringify(sealed).includes(token),
        rawRecordHasToken: JSON.stringify(rawKey).includes(token),
        domHasToken: document.documentElement.outerHTML.includes(token),
        urlHasToken: location.href.includes(token),
        database: expected.credentialDatabase.name,
      };
      return { sealed, probe };
    }, { token, expected: EXPECTATIONS });
    sealed = first.sealed;
    check(first.probe.sealedVersion === EXPECTATIONS.vault.sealedVersion, "browser vault sealed version matches the contract");
    check(first.probe.algorithm === EXPECTATIONS.vault.algorithm, "browser vault uses AES-GCM");
    check(first.probe.ivBytes === EXPECTATIONS.vault.ivBytes, "browser vault uses a 96-bit IV");
    check(first.probe.rawKeyIsCryptoKey, "IndexedDB stores a CryptoKey record");
    check(first.probe.rawKeyExtractable === false, "persisted credential key is non-extractable");
    check(first.probe.rawKeyAlgorithm === EXPECTATIONS.vault.algorithm && first.probe.rawKeyLength === EXPECTATIONS.vault.keyLength, "persisted key algorithm and length are bounded");
    assert.deepEqual(first.probe.rawKeyUsages, EXPECTATIONS.vault.keyUsages, "persisted key usages are encryption-only");
    check(first.probe.database === EXPECTATIONS.credentialDatabase.name, "credential key is stored in the context-owned database");
    check(first.probe.exportRejected === EXPECTATIONS.vault.exportKeyRejected, "raw key export is rejected by WebCrypto");
    check(first.probe.unsealedMatches, "sealed credentials decrypt before reload");
    check(!first.probe.sealedHasToken && !first.probe.rawRecordHasToken, "plaintext token is absent from sealed and raw IndexedDB records");
    check(!first.probe.domHasToken && !first.probe.urlHasToken, "credential token is absent from DOM and URL");

    await page.evaluate(() => {
      document.cookie = "repforge_setup_v1=v1.setup-canary; Path=/index.html; SameSite=Lax";
    });
    const cookieResult = await page.evaluate(async ({ token }) => {
      const transfer = window.RepForgeInstallTransfer;
      const wrote = transfer.writeTransferCookie({ token, expiresAt: "2099-01-01T00:00:00.000Z" });
      const parsed = transfer.readTransferCookie();
      const rawCookie = document.cookie;
      return {
        wrote,
        parsedMatches: parsed?.token === token,
        setupPresent: rawCookie.includes("repforge_setup_v1="),
        transferPresent: rawCookie.includes("repforge_transfer_v1="),
        rawTokenPresent: rawCookie.includes(token),
      };
    }, { token: "browser-cookie-token-" + "y".repeat(32) });
    check(cookieResult.wrote, "browser transfer cookie write succeeds");
    check(cookieResult.parsedMatches, "browser transfer cookie round-trips through the exported parser");
    check(cookieResult.setupPresent && cookieResult.transferPresent, "setup and transfer cookies coexist");
    check(!cookieResult.rawTokenPresent, "raw transfer token is absent from document.cookie text");

    const cookies = await context.cookies(INDEX_URL);
    const setupCookie = cookies.find((cookie) => cookie.name === EXPECTATIONS.cookies.setupName);
    const transferCookie = cookies.find((cookie) => cookie.name === EXPECTATIONS.cookies.transferName);
    check(Boolean(setupCookie && transferCookie), "browser context retains both cookie objects");
    check(transferCookie?.path === EXPECTATIONS.cookies.path && transferCookie?.sameSite === EXPECTATIONS.cookies.sameSite, "transfer cookie has the exact path and SameSite policy");
    check(transferCookie?.secure === EXPECTATIONS.cookies.secureOnLocalhost, "localhost transfer cookie omits Secure");
    check(!transferCookie?.value.includes("browser-cookie-token-"), "encoded cookie value does not expose the raw token");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.addScriptTag({ url: moduleUrl() });
    const afterReload = await page.evaluate(async ({ token, sealed, expected }) => {
      const transfer = window.RepForgeInstallTransfer;
      const vault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      const value = await vault.unseal("browser-outbound", sealed);
      return {
        sameCredential: value?.token === token && value?.claimId === "browser-claim-id",
        keyId: sealed.keyId,
        dbName: expected.credentialDatabase.name,
      };
    }, { token, sealed, expected: EXPECTATIONS });
    check(afterReload.sameCredential, "credential decrypts after a real page reload");
    check(afterReload.dbName === EXPECTATIONS.credentialDatabase.name, "reload uses the context-owned credential database");

    const keyLoss = await page.evaluate(async ({ sealed, expected }) => {
      const transfer = window.RepForgeInstallTransfer;
      const vault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      const keyName = `${expected.credentialDatabase.keyNamePrefix}${sealed.keyId}`;
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open(expected.credentialDatabase.name);
        request.onerror = () => reject(request.error || new Error("credential-db-open-failed"));
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(expected.credentialDatabase.store, "readwrite");
        const request = transaction.objectStore(expected.credentialDatabase.store).delete(keyName);
        request.onerror = () => reject(request.error || new Error("credential-key-delete-failed"));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("credential-key-delete-failed"));
      });
      database.close();
      let unsealRejected = false;
      try { await vault.unseal("browser-outbound", sealed); }
      catch { unsealRejected = true; }
      const request = indexedDB.open(expected.credentialDatabase.name);
      const rawKey = await new Promise((resolve) => {
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const database = request.result;
          const read = database.transaction(expected.credentialDatabase.store, "readonly").objectStore(expected.credentialDatabase.store).get(keyName);
          read.onerror = () => { database.close(); resolve(null); };
          read.onsuccess = () => { database.close(); resolve(read.result || null); };
        };
      });
      return { unsealRejected, rawRecordRemoved: rawKey === null };
    }, { sealed, expected: EXPECTATIONS });
    check(keyLoss.unsealRejected === EXPECTATIONS.keyLoss.unsealRejects, "lost IndexedDB key rejects credential recovery");
    check(keyLoss.rawRecordRemoved === EXPECTATIONS.keyLoss.externalKeyLossRemovesRawRecord, "external key loss removes the persisted credential key");
  } finally {
    await context.clearCookies().catch(() => {});
    await browser.close();
  }
  await writeReport({ result: "passed", limitations: ["shared contract parity and client status recovery remain pending reviewed module integration"] });
  console.log(`install-transfer browser client: ${checks.length} assertions passed`);
}

try {
  await main();
} catch (error) {
  await writeReport({ result: "failed", errorType: error?.name || "Error" }).catch(() => {});
  throw error;
}
