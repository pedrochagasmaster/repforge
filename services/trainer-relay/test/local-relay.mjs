// A local relay: the real Worker bundle in workerd (Miniflare) with its
// Durable Objects persisted to a temporary directory, so a proof can inspect
// every byte the service stored. Test secrets only.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const require = createRequire(import.meta.url);
export const SERVICE = dirname(dirname(fileURLToPath(import.meta.url)));
export const ROOT = dirname(dirname(SERVICE));
export const Contract = require(join(ROOT, "trainer-relay-contract.js"));
export const Client = require(join(ROOT, "trainer-relay.js"));

export const TEST_SECRETS = Object.freeze({
  RELAY_ROUTING_KEY_B64: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
  RELAY_RATE_PEPPER_B64: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
  RELAY_OPS_SECRET: "test-ops-secret-0123456789012345678901234567",
});
export const APP_ORIGIN = "https://taurifer.com";
export const SERVICE_ORIGIN = "https://relay.test";

let bundled;
async function workerScript() {
  if (!bundled) {
    const result = await build({
      entryPoints: [join(SERVICE, "src/index.js")],
      bundle: true,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      external: ["cloudflare:workers"],
      write: false,
      logLevel: "silent",
    });
    bundled = result.outputFiles[0].text;
  }
  return bundled;
}

export async function startRelay(vars = {}, { persistDir, outbound } = {}) {
  const dir = persistDir || mkdtempSync(join(tmpdir(), "trainer-relay-"));
  const options = {
    modules: true,
    script: await workerScript(),
    // The newest date this pinned local runtime accepts; the deployed date is in wrangler.jsonc.
    compatibilityDate: "2026-07-01",
    durableObjects: {
      RELAY_RECORDS: { className: "RelayRecordDurableObject", useSQLite: true },
      RELAY_RATE: { className: "RelayRateDurableObject", useSQLite: true },
      RELAY_METER: { className: "RelayMeterDurableObject", useSQLite: true },
    },
    durableObjectsPersist: dir,
    bindings: {
      RELAY_ALLOWED_ORIGINS: "https://taurifer.com,https://studio.taurifer.com",
      RELAY_CREATES_ENABLED: "true",
      RELAY_KILL_SWITCH: "false",
      RELAY_LOCAL_TEST_EU: "true",
      ...TEST_SECRETS,
      ...vars,
    },
    ...(outbound ? { outboundService: outbound } : {}),
  };
  const mf = new Miniflare(options);
  await mf.ready;
  const received = [];
  /** A fetch for the client: adds what a browser and the edge add, and records what the service received. */
  function fetchFrom(address = "198.51.100.7", origin = APP_ORIGIN) {
    return async (url, init = {}) => {
      const headers = { ...(init.headers || {}), Origin: origin, "CF-Connecting-IP": address };
      received.push({ url: String(url), headers: JSON.stringify(headers), body: typeof init.body === "string" ? init.body : "" });
      const { redirect, cache, credentials, referrerPolicy, ...rest } = init;
      return mf.dispatchFetch(url, { ...rest, headers });
    };
  }
  async function post(path, body, { address = "198.51.100.7", origin = APP_ORIGIN, headers = {} } = {}) {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    received.push({ url: path, headers: "", body: text });
    return mf.dispatchFetch(SERVICE_ORIGIN + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": address, ...headers },
      body: text,
    });
  }
  async function ops(path, body = {}) {
    return mf.dispatchFetch(SERVICE_ORIGIN + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_SECRETS.RELAY_OPS_SECRET}` },
      body: JSON.stringify(body),
    });
  }
  async function recordStub(id) {
    const { recordObjectName } = await import("../src/crypto.js");
    const namespace = await mf.getDurableObjectNamespace("RELAY_RECORDS");
    const routing = Contract.base64UrlDecode(TEST_SECRETS.RELAY_ROUTING_KEY_B64);
    return namespace.get(namespace.idFromName(await recordObjectName(id, routing)));
  }
  async function meterStub() {
    const namespace = await mf.getDurableObjectNamespace("RELAY_METER");
    return namespace.get(namespace.idFromName("global"));
  }
  /** Every byte under the persistence directory, file by file. */
  function storedFiles() {
    const files = [];
    const walk = (path) => {
      for (const name of readdirSync(path)) {
        const full = join(path, name);
        if (statSync(full).isDirectory()) walk(full);
        else files.push({ path: full, bytes: readFileSync(full) });
      }
    };
    walk(dir);
    return files;
  }
  return {
    mf, dir, received, fetchFrom, post, ops, recordStub, meterStub, storedFiles,
    clientOptions: (extra = {}) => ({ serviceOrigin: SERVICE_ORIGIN, linkBase: APP_ORIGIN + "/", fetch: fetchFrom(), ...extra }),
    async restart(nextVars) {
      await mf.dispose();
      return startRelay({ ...vars, ...nextVars }, { persistDir: dir, outbound });
    },
    async stop({ keep = false } = {}) {
      await mf.dispose();
      if (!keep) rmSync(dir, { recursive: true, force: true });
    },
  };
}
