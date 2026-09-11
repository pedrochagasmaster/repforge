#!/usr/bin/env node
/**
 * Real-browser evidence for the client credential boundary.
 *
 * This suite deliberately loads only the exported install-transfer client and
 * uses the existing app shell as an origin for real IndexedDB and cookie
 * behavior. Shared-contract parity is covered by the separate Node/browser
 * consumer suite; this boundary proof stays focused on the browser vault.
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
const FAULT_EXPECTATIONS = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-client/fault-expectations.json"), "utf8"));
const ARTIFACT_DIR = process.env.REPFORGE_ARTIFACT_DIR || "/tmp/plan053-p3";
const COOKIE_TOKEN = "v1.k1.AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA.AgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICE.AwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISI";
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
    }, { token: COOKIE_TOKEN });
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
    check(!transferCookie?.value.includes(COOKIE_TOKEN), "encoded cookie value does not expose the raw token");

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

    const producerBoundary = await page.evaluate(() => {
      const hook = window.__repforgeWorkoutDraft;
      const producer = window.RepForgeWorkoutDraft;
      const hookMethods = ["flush", "current", "checkpoint", "read"].every((name) => typeof hook?.[name] === "function");
      const moduleReady = typeof producer?.logicalCloneSection === "function";
      let current = null;
      let normalized = null;
      let failed = false;
      try {
        current = hookMethods ? hook.current() : null;
        if (current !== null && current !== undefined && moduleReady) normalized = producer.logicalCloneSection(current);
      } catch {
        failed = true;
      }
      const normalizedObject = normalized !== null && typeof normalized === "object" && !Array.isArray(normalized) && normalized.kind !== "error" && normalized.ok !== false;
      return {
        hookMethods,
        hookHasLogicalClone: typeof hook?.logicalCloneSection === "function",
        moduleReady,
        currentAbsent: current === null || current === undefined,
        normalizedObject,
        normalizedStripsVolatile: normalizedObject && !Object.hasOwn(normalized, "writer") && !Object.hasOwn(normalized, "revision") && !Object.hasOwn(normalized.program || {}, "durableRevision"),
        failed,
      };
    });
    check(producerBoundary.hookMethods && producerBoundary.moduleReady && !producerBoundary.failed, "real app draft producer does not expose the acknowledged hook and logical normalizer seam");
    check(producerBoundary.currentAbsent || (producerBoundary.normalizedObject && producerBoundary.normalizedStripsVolatile), "real app draft producer normalization retained volatile storage metadata");
    check(!producerBoundary.hookHasLogicalClone, "clone client does not silently treat the raw app draft hook as its logical producer");

    const abortProbe = await page.evaluate(async ({ expected }) => {
      const transfer = window.RepForgeInstallTransfer;
      const vault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      const originalTransaction = IDBDatabase.prototype.transaction;
      let abortScheduled = false;
      IDBDatabase.prototype.transaction = function (...args) {
        const transaction = originalTransaction.apply(this, args);
        if (!abortScheduled && args[1] === "readwrite") {
          abortScheduled = true;
          queueMicrotask(() => { try { transaction.abort(); } catch {} });
        }
        return transaction;
      };
      let rejected = false;
      try { await vault.seal("browser-abort", { token: "browser-abort-token" }); }
      catch { rejected = true; }
      finally { IDBDatabase.prototype.transaction = originalTransaction; }
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open(expected.credentialDatabase.name);
        request.onerror = () => reject(request.error || new Error("credential-db-open-failed"));
        request.onsuccess = () => resolve(request.result);
      });
      const keys = await new Promise((resolve, reject) => {
        const transaction = database.transaction(expected.credentialDatabase.store, "readonly");
        const request = transaction.objectStore(expected.credentialDatabase.store).getAllKeys();
        request.onerror = () => reject(request.error || new Error("credential-key-list-failed"));
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return { rejected, abortScheduled, contextRecords: keys.filter((key) => String(key).startsWith("browser-abort:")).length };
    }, { expected: EXPECTATIONS });
    check(abortProbe.abortScheduled && abortProbe.rejected, "real IndexedDB transaction abort did not reject the vault write");
    check(abortProbe.contextRecords === 0, "aborted credential write left a persisted key");

    const faultProbes = await page.evaluate(async ({ token, expected }) => {
      const transfer = window.RepForgeInstallTransfer;
      const contract = {
        canonicalJson: (value) => JSON.stringify(value),
        validateEnvelope: (value) => ({ ok: true, value }),
        validateEnvelopeIntegrity: async (value) => ({ ok: true, value }),
        validateRequest: (value) => ({ ok: true, value }),
        validateClaimId: (value) => ({ ok: true, value }),
        parseBoundedJson: (bytes) => {
          try {
            const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            return { ok: true, value: JSON.parse(new TextDecoder().decode(raw)) };
          } catch { return { ok: false, code: "invalid-json" }; }
        },
      };
      const markerStore = (initial = null) => {
        let value = initial;
        return {
          async read() { return value ? structuredClone(value) : value; },
          async write(next) { value = next ? structuredClone(next) : next; },
          async clear() { value = null; },
          peek() { return value ? structuredClone(value) : value; },
        };
      };
      const lock = () => {
        let tail = Promise.resolve();
        return { withLock(_name, work) { const next = tail.then(work); tail = next.catch(() => {}); return next; } };
      };
      const bytes = (body) => new TextEncoder().encode(JSON.stringify(body));
      const location = { href: "http://127.0.0.1:8055/index.html" };
      const expiry = "2099-01-01T00:00:00.000Z";

      const abortInbound = markerStore();
      let abortPosts = 0;
      const abortTransport = { async request() { abortPosts += 1; return { status: 500, bytes: bytes({}) }; } };
      const abortClient = transfer.createClient({ contract, crypto: globalThis.crypto, context: "standalone", document, location, transport: abortTransport, storage: { inbound: abortInbound, credentials: transfer.createCredentialVault({ crypto: globalThis.crypto }), operationLock: lock() } });
      transfer.writeTransferCookie({ token, expiresAt: expiry }, { document, location });
      const originalTransaction = IDBDatabase.prototype.transaction;
      let abortScheduled = false;
      IDBDatabase.prototype.transaction = function (...args) {
        const transaction = originalTransaction.apply(this, args);
        if (!abortScheduled && args[1] === "readwrite") {
          abortScheduled = true;
          queueMicrotask(() => { try { transaction.abort(); } catch {} });
        }
        return transaction;
      };
      const abortResult = await abortClient.claim();
      IDBDatabase.prototype.transaction = originalTransaction;
      transfer.clearTransferCookie({ document, location });

      const raceInbound = markerStore();
      const raceLock = lock();
      const raceVault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      let raceCalls = 0;
      const raceRequests = [];
      const raceTransport = {
        async request(request) {
          raceRequests.push({ claimId: request.body.claimId });
          raceCalls += 1;
          if (raceCalls === 1) { await gate; throw new Error("claim-response-lost"); }
          return { status: 200, bytes: bytes({ envelope: {}, expiresAt: expiry }) };
        },
      };
      transfer.writeTransferCookie({ token, expiresAt: expiry }, { document, location });
      const raceClientA = transfer.createClient({ contract, crypto: globalThis.crypto, context: "standalone", document, location, transport: raceTransport, storage: { inbound: raceInbound, credentials: raceVault, operationLock: raceLock } });
      const raceClientB = transfer.createClient({ contract, crypto: globalThis.crypto, context: "standalone", document, location, transport: raceTransport, storage: { inbound: raceInbound, credentials: raceVault, operationLock: raceLock } });
      const raceFirst = raceClientA.claim();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const raceSecond = raceClientB.claim();
      await new Promise((resolve) => setTimeout(resolve, 0));
      release();
      const raceResults = await Promise.all([raceFirst, raceSecond]);
      const raceMarker = raceInbound.peek();
      if (raceMarker?.sealedCredentials) await raceVault.forget("standalone-inbound", raceMarker.sealedCredentials).catch(() => {});
      transfer.clearTransferCookie({ document, location });

      const cleanupVault = transfer.createCredentialVault({ crypto: globalThis.crypto });
      const cleanupSealed = await cleanupVault.seal("browser-outbound", { token });
      const cleanupOutbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: cleanupSealed, expiresAt: expiry });
      let deleteFailures = 1;
      const cleanupCredentials = {
        seal: (...args) => cleanupVault.seal(...args),
        unseal: (...args) => cleanupVault.unseal(...args),
        async forget(...args) {
          if (deleteFailures > 0) { deleteFailures -= 1; throw new Error("credential-delete-fault"); }
          return cleanupVault.forget(...args);
        },
      };
      let statusCalls = 0;
      const cleanupClient = transfer.createClient({
        contract,
        crypto: globalThis.crypto,
        context: "browser",
        document,
        location,
        transport: { async request() { statusCalls += 1; return { status: 200, bytes: bytes({ state: "deleted", expiresAt: expiry }) }; } },
        storage: { outbound: cleanupOutbound, credentials: cleanupCredentials, operationLock: lock() },
      });
      transfer.writeTransferCookie({ token, expiresAt: expiry }, { document, location });
      const cleanupFirst = await cleanupClient.status();
      const pending = cleanupOutbound.peek();
      const cleanupSecond = await cleanupClient.status();
      const confirmed = cleanupOutbound.peek();
      transfer.clearTransferCookie({ document, location });
      return {
        abort: { scheduled: abortScheduled, rejected: !abortResult.ok, posts: abortPosts, markerWritten: Boolean(abortInbound.peek()) },
        race: {
          firstUnknown: raceResults[0]?.state === "unknown-outcome",
          secondValidating: raceResults[1]?.ok === true && raceResults[1]?.state === "validating",
          oneClaimId: raceRequests.length === 2 && raceRequests[0].claimId === raceRequests[1].claimId,
          markerClaimed: raceMarker?.phase === "claimed",
        },
        cleanup: {
          firstUnknown: cleanupFirst?.state === expected.cleanup.credentialDeleteFailureState && cleanupFirst?.code === expected.cleanup.credentialDeleteFailureCode,
          pending: pending?.phase === "cleanup-pending" && Boolean(pending.sealedCredentials),
          secondConfirmed: cleanupSecond?.ok === true && cleanupSecond?.state === "confirmed",
          noSealedFinal: confirmed?.phase === "confirmed" && !confirmed.sealedCredentials,
          oneStatusRequest: statusCalls === 1,
        },
      };
    }, { token: COOKIE_TOKEN, expected: FAULT_EXPECTATIONS });
    check(faultProbes.abort.scheduled && faultProbes.abort.rejected && faultProbes.abort.posts === 0 && !faultProbes.abort.markerWritten, "aborted inbound credential seal posted or left a marker before transaction acknowledgement");
    check(faultProbes.race.firstUnknown && faultProbes.race.secondValidating && faultProbes.race.oneClaimId && faultProbes.race.markerClaimed, "real-browser claim race lost its single claim identity");
    check(faultProbes.cleanup.firstUnknown && faultProbes.cleanup.pending, "real-browser cleanup reported success after credential deletion failure");
    check(faultProbes.cleanup.secondConfirmed && faultProbes.cleanup.noSealedFinal && faultProbes.cleanup.oneStatusRequest, "real-browser cleanup retry did not leave a digest-only recovery snapshot");

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
  await writeReport({ result: "passed", limitations: ["client status recovery is covered by the injected transport suites; no service HTTP proof", "fault probes use an explicit local contract double"] });
  console.log(`install-transfer browser client: ${checks.length} assertions passed`);
}

try {
  await main();
} catch (error) {
  await writeReport({ result: "failed", errorType: error?.name || "Error" }).catch(() => {});
  throw error;
}
