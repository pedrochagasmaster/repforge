// Evaluates the production app runtime in Node for fixture generators: the
// scripts index.html loads, in order, over a minimal browser shell, with the
// local catalog asset served to the real loader. boot() is not run.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export async function loadAppRuntime(exportNames) {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const require2 = createRequire(import.meta.url); void require2;

  // Minimal browser shell so app.js evaluates without a DOM.
  globalThis.window = {
    RepForgeI18n: { t: (k) => k, detectLang: () => "en", setLang() {}, normalizeLang: (v) => (v === 'pt' ? 'pt' : 'en'), },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
  };
  globalThis.document = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, hidden: false,
    documentElement: { setAttribute() {}, style: {}, dataset: {} },
    head: { append() {}, appendChild() {} },
    body: { classList: { add() {}, remove() {}, contains: () => false } },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, addEventListener() {} }),
  };
  class MemoryStorage {
    constructor() { this.values = new Map(); }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
  }
  const localStorage = new MemoryStorage();
  const idbValues = new Map();
  const idbClone = (value) => JSON.parse(JSON.stringify(value));
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "navigator", { value: { language: "en", onLine: true }, configurable: true, writable: true });
  globalThis.location = { href: "http://localhost:8000/", pathname: "/", search: "", hash: "" };
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            const tx = {
              oncomplete: null,
              onerror: null,
              objectStore() {
                return {
                  get(key) {
                    const result = { result: undefined, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      result.result = idbValues.has(key) ? idbClone(idbValues.get(key)) : undefined;
                      result.onsuccess?.();
                    });
                    return result;
                  },
                  put(value, key) {
                    idbValues.set(key, idbClone(value));
                    queueMicrotask(() => tx.oncomplete?.());
                  },
                  delete(key) {
                    idbValues.delete(key);
                    queueMicrotask(() => tx.oncomplete?.());
                  },
                };
              },
            };
            return tx;
          },
        };
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  globalThis.CustomEvent = class CustomEvent {};
  // The only fetch app boot needs here is the local catalog asset, served as-is.
  const CATALOG_BYTES = readFileSync(join(ROOT, "assets/exercise-catalog.json"), "utf8");
  globalThis.fetch = async (url) => String(url).includes("assets/exercise-catalog.json")
    ? { ok: true, status: 200, text: async () => CATALOG_BYTES } : { ok: false, status: 404 };
  globalThis.caches = { open: async () => ({ match: async () => undefined }) };

  // Load every runtime script index.html declares before app.js, in order, as
  // the page does, and mirror their globals onto the shell window app.js reads.
  // Vendored motion/drag runtimes are optional and skipped.
  const scripts = [...readFileSync(join(ROOT, "index.html"), "utf8").matchAll(/<script[^>]*src="([^"?]+)/g)]
    .map((match) => match[1]).filter((file) => file.endsWith(".js") && file !== "app.js" && !file.startsWith("vendor/"));
  for (const file of scripts) {
    try { new Function("module", "exports", readFileSync(join(ROOT, file), "utf8")).call(globalThis, undefined, undefined); }
    catch (error) { if (!["posthog-config.js", "posthog-init.js"].includes(file)) throw error; }
    // Modules attach to window or globalThis; the page has one object for both.
    for (const [from, to] of [[globalThis, globalThis.window], [globalThis.window, globalThis]])
      for (const key of Object.keys(from)) if (/^RepForge|^Taurifer|^EXERCISE_/.test(key) && !(key in to)) to[key] = from[key];
  }
  const Compiler = globalThis.window.RepForgeProgramCompiler;
  globalThis.ProgramCompiler = Compiler;
  const Adapter = globalThis.window.RepForgeProgramEntryAdapter;
  await globalThis.window.RepForgeExerciseCatalog.load();
  const catalogSnapshot = globalThis.window.RepForgeExerciseCatalog.snapshot();
  const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
  // The production file invokes boot() as its final expression. Omit only that
  // auto-start while loading the same runtime functions so this fixture can
  // drive the persistence boundary without a concurrent application boot write.
  // The catalog is installed the way a successful load() would install it.
  const appRuntimeSrc = appSrc.replace(/\nboot\(\);\s*$/, "\n") + "\n;rawExerciseCatalog=globalThis.__appRuntimeCatalog;";
  globalThis.__appRuntimeCatalog = catalogSnapshot;
  const api = new Function(appRuntimeSrc + `
;return {${exportNames.map((name) => `${name}: typeof ${name} !== "undefined" ? ${name} : null`).join(", ")}};`).call(globalThis);
  return { ...api, Compiler, Adapter, catalogSnapshot, ROOT, localStorage, MemoryStorage };
}
