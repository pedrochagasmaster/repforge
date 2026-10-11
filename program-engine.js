/* The program engine (#353): generation and block regeneration off the main
   thread. This one file is both halves. In a page it defines
   RepForgeProgramEngine, whose engines start a dedicated worker from this
   same URL; in that worker it loads the page's exact compiler, transition and
   catalog scripts and answers requests. The worker reads the catalog itself,
   through the same integrity-pinned loader the page uses, so no catalog is
   copied across threads. When a worker cannot run (no Worker, the script or
   the catalog fails to load, the worker dies), the same compiler runs on the
   main thread, so the output never depends on where it ran. */
(function attachProgramEngine(root) {
  "use strict";

  const inWorker = typeof WorkerGlobalScope !== "undefined" && root instanceof WorkerGlobalScope;

  if (inWorker) {
    let ready = null;
    const init = (scripts, catalogSha256) => {
      if (!ready) {
        ready = Promise.resolve().then(() => {
          // exercise-catalog.js reads its integrity pin from the search index,
          // which this worker never loads.
          root.RepForgeExercises = { library: [], catalogSha256 };
          root.importScripts(...scripts);
          return root.RepForgeExerciseCatalog.load();
        });
      }
      return ready;
    };
    const run = (message) => {
      if (message.type === "generate") {
        return root.RepForgeProgramCompiler.generateProgram(message.request, root.RepForgeExerciseCatalog.snapshot(), message.seed);
      }
      // Without a catalogSnapshot the transition domain reads this worker's catalog.
      return root.RepForgeProgramTransition.deriveSuccessor(message.input);
    };
    root.onmessage = async (event) => {
      const message = event.data || {};
      if (message.type === "init") {
        try {
          await init(message.scripts, message.catalogSha256);
          root.postMessage({ type: "ready" });
        } catch (error) {
          root.postMessage({ type: "failed", message: String(error?.message || error) });
        }
        return;
      }
      try {
        root.postMessage({ id: message.id, ok: true, value: run(message) });
      } catch (error) {
        root.postMessage({ id: message.id, ok: false, message: String(error?.message || error) });
      }
    };
    return;
  }

  const ownUrl = typeof document !== "undefined" && document.currentScript?.src || null;

  function abortError() {
    return typeof DOMException === "function" ? new DOMException("The generation request was superseded", "AbortError")
      : Object.assign(new Error("The generation request was superseded"), { name: "AbortError" });
  }

  /* options:
     - compiler, transition: the page's modules, for the main-thread path;
     - catalog(): the page's verified raw catalog;
     - worker: { url, scripts, catalogSha256 } or null to stay on the main
       thread. scripts are the absolute URLs the page itself loaded. */
  function create(options) {
    const opts = options || {};
    const counts = { worker: 0, main: 0 };
    const queue = [];
    let mode = opts.worker && typeof root.Worker === "function" ? "pending" : "main";
    let worker = null, started = null, active = null;
    let settleStart = () => {};

    function runOnMain(job) {
      counts.main++;
      if (job.type === "generate") return opts.compiler.generateProgram(job.request, opts.catalog(), job.seed);
      return opts.transition.deriveSuccessor({ ...job.input, catalogSnapshot: opts.catalog() });
    }

    // Once the worker is unusable every queued and future job runs here.
    function fallBack() {
      if (worker) { try { worker.terminate(); } catch {} }
      worker = null;
      mode = "main";
      settleStart("main");
      const pending = active ? [active, ...queue] : [...queue];
      active = null;
      queue.length = 0;
      for (const job of pending) settle(job, () => runOnMain(job));
    }

    function settle(job, compute) {
      if (job.signal?.aborted) { job.reject(abortError()); return; }
      try { job.resolve(compute()); } catch (error) { job.reject(error); }
    }

    function start() {
      if (started) return started;
      started = new Promise((resolve) => { settleStart = resolve; });
      if (mode === "main") { settleStart("main"); return started; }
      try {
        worker = new root.Worker(opts.worker.url);
      } catch {
        fallBack();
        return started;
      }
      worker.onerror = (event) => { event?.preventDefault?.(); fallBack(); };
      worker.onmessageerror = () => fallBack();
      worker.onmessage = (event) => {
        const message = event.data || {};
        if (message.type === "ready") { mode = "worker"; settleStart("worker"); pump(); return; }
        if (message.type === "failed") { fallBack(); return; }
        const job = active;
        if (!job || message.id !== job.id) return;
        active = null;
        counts.worker++;
        if (job.signal?.aborted) job.reject(abortError());
        else if (message.ok) job.resolve(message.value);
        else job.reject(new Error(message.message));
        pump();
      };
      worker.postMessage({ type: "init", scripts: opts.worker.scripts, catalogSha256: opts.worker.catalogSha256 });
      return started;
    }

    // One job at a time is in the worker, so a superseded job still waiting
    // here is dropped before it costs anything.
    function pump() {
      while (!active && queue.length) {
        const job = queue.shift();
        if (job.signal?.aborted) { job.reject(abortError()); continue; }
        if (mode === "main") { settle(job, () => runOnMain(job)); continue; }
        active = job;
        const { resolve, reject, signal, ...message } = job;
        worker.postMessage(message);
      }
    }

    let nextId = 0;
    function submit(job, signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(abortError()); return; }
        const entry = { ...job, id: ++nextId, signal, resolve, reject };
        // An abort answers at once; a job already in the worker finishes there
        // and its result is dropped.
        signal?.addEventListener?.("abort", () => {
          const at = queue.indexOf(entry);
          if (at >= 0) queue.splice(at, 1);
          reject(abortError());
        }, { once: true });
        queue.push(entry);
        if (mode === "pending") start();
        // A main-thread job runs after the caller's current task, like a worker reply.
        if (mode === "main") Promise.resolve().then(pump);
        else if (mode === "worker") pump();
      });
    }

    return Object.freeze({
      /** generateProgram(request, catalog, seed), resolved off the main thread when possible. */
      generate: (request, seed, { signal } = {}) => submit({ type: "generate", request, seed }, signal),
      /** RepForgeProgramTransition.deriveSuccessor(input) against the release catalog; input carries no catalog. */
      derive: (input, { signal } = {}) => {
        const { catalogSnapshot, ...rest } = input || {};
        return submit({ type: "derive", input: rest }, signal);
      },
      /** Starts the worker if needed; resolves "worker" or "main" once that is known. */
      ready: () => start(),
      stats: () => ({ mode, ...counts }),
    });
  }

  /** The absolute URL of a script the page loaded, matched by file name. */
  function pageScript(name) {
    if (typeof document === "undefined") return null;
    const script = [...document.scripts].find((item) => {
      try { return new URL(item.src).pathname.endsWith(`/${name}`); } catch { return false; }
    });
    return script ? script.src : null;
  }

  const api = Object.freeze({ create, pageScript, url: ownUrl });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
