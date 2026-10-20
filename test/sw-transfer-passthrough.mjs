#!/usr/bin/env node
import {Contract} from './interchange-runtime.mjs';
/**
 * The production install-transfer Worker is routed at the app's own origin
 * (`taurifer.com/v1/*`). The service worker must leave every `/v1/` request to
 * the network: no cached copy, no navigation shell, and no offline fallback
 * may answer a transfer endpoint. Runs the real sw.js fetch listener in a VM.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(ROOT, "sw.js"), "utf8");
// The contract's ENDPOINTS also names the `/envelope` validation mode, which is not a URL.
const ENDPOINTS = Object.values(Contract.ENDPOINTS)
  .filter((path) => path.startsWith("/v1/"));
assert.equal(ENDPOINTS.length, 4, "the four transfer endpoints live under /v1/");

function loadWorker(scope) {
  const listeners = new Map();
  const self = {
    registration: { scope },
    location: new URL("sw.js", scope),
    addEventListener(type, listener) { listeners.set(type, listener); },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
  };
  const context = vm.createContext({ self, URL, Response, Request, Headers, console, caches: {}, fetch: async () => { throw new Error("network not used in this proof"); } });
  vm.runInContext(source, context, { filename: "sw.js" });
  const fetchListener = listeners.get("fetch");
  assert.equal(typeof fetchListener, "function", "sw.js registers a fetch listener");
  return fetchListener;
}

function dispatch(listener, url, { method = "GET", mode = "cors" } = {}) {
  let responded = false;
  // A handled request starts cache work this proof does not model; only the respondWith decision matters.
  listener({ request: { url, method, mode }, respondWith(promise) { responded = true; Promise.resolve(promise).catch(() => {}); } });
  return responded;
}

const cases = [];
for (const scope of ["https://taurifer.com/", "https://preview.taurifer.pages.dev/"]) {
  const listener = loadWorker(scope);
  const origin = new URL(scope).origin;
  for (const path of [...ENDPOINTS, "/v1/", "/v1/unknown"]) {
    for (const request of [{ method: "POST" }, { method: "OPTIONS" }, { method: "GET" }, { method: "GET", mode: "navigate" }]) {
      const url = origin + path;
      cases.push(url);
      assert.equal(dispatch(listener, url, request), false, `${request.method} ${request.mode || "cors"} ${url} must go to the network`);
    }
  }
  // The bypass is scoped to the transfer prefix: the shell and assets are still served by the worker.
  assert.equal(dispatch(listener, origin + "/", { mode: "navigate" }), true, "the app shell navigation is still handled");
  assert.equal(dispatch(listener, origin + "/v1.css"), true, "a non-/v1/ path is still handled");
  assert.equal(dispatch(listener, origin + "/icons/icon.svg"), true, "release assets are still handled");
}

console.log(`sw transfer passthrough: ${cases.length} /v1/ requests left to the network`);
