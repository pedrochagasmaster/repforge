/* @dnd-kit/dom 0.5.0 — lazy runtime bootstrap for Taurifer. Generated file: do not edit.
   Heavy runtime: vendor/dnd-kit/dnd-kit.runtime.js
   Regenerate with: node tools/build-vendor-runtimes.mjs dnd-kit */
(function (global) {
  "use strict";
  let pending = null;
  const ready = () => !!global.DndKit?.DragDropManager;
  function load() {
    if (ready()) return Promise.resolve(global.DndKit);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/dnd-kit/dnd-kit.runtime.js";
      script.async = true;
      script.dataset.tauriferRuntime = "dnd-kit";
      script.onload = () => ready()
        ? resolve(global.DndKit)
        : reject(new Error("@dnd-kit runtime loaded without DndKit global"));
      script.onerror = () => reject(new Error("Unable to load vendored @dnd-kit runtime"));
      document.head.append(script);
    });
    return pending;
  }
  global.RepForgeDndRuntime = { available: ready, load };
  const prime = () => load().catch(() => {});
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(prime, 0), { once: true });
  else setTimeout(prime, 0);
})(typeof window !== "undefined" ? window : this);
