/** Module-worker executor; page and worker import the same deterministic compiler. */
export const url = new URL("./program-worker.js", import.meta.url).href;
function abortError() {
  return typeof DOMException === "function" ? new DOMException("The generation request was superseded", "AbortError")
    : Object.assign(new Error("The generation request was superseded"), { name: "AbortError" });
}

/* options:
   - compiler, transition: the page's modules, for the main-thread path;
   - catalog(): the page's verified raw catalog;
   - worker: { url, scripts, catalogSha256 } or null to stay on the main
     thread. scripts are the absolute URLs the page itself loaded. */
export function create(options) {
  const opts = options || {};
  const WorkerConstructor=opts.WorkerConstructor || globalThis.Worker;
  const counts = { worker: 0, main: 0 };
  const queue = [];
  let mode = opts.worker && typeof WorkerConstructor === "function" ? "pending" : "main";
  let worker = null, started = null, active = null, disposed = false;
  let settleStart = () => {};

  function runOnMain(job) {
    counts.main++;
    if (job.type === "generate") return opts.compiler.generateProgram(job.request, opts.catalog());
    return opts.transition.deriveSuccessor({ ...job.input, catalogSnapshot: opts.catalog() });
  }

  // Once the worker is unusable every queued and future job runs here.
  function fallBack() {
    if (disposed) return;
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
    if (disposed) return Promise.resolve("disposed");
    started = new Promise((resolve) => { settleStart = resolve; });
    if (mode === "main") { settleStart("main"); return started; }
    try {
      worker = new WorkerConstructor(opts.worker.url, { type: "module" });
    } catch {
      fallBack();
      return started;
    }
    worker.onerror = (event) => { event?.preventDefault?.(); fallBack(); };
    worker.onmessageerror = () => fallBack();
    worker.onmessage = (event) => {
      if (disposed) return;
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
    worker.postMessage({ type: "init", catalogSha256: opts.worker.catalogSha256, catalogUrl: opts.worker.catalogUrl });
    return started;
  }

  // One job at a time is in the worker, so a superseded job still waiting
  // here is dropped before it costs anything.
  function pump() {
    if (disposed) return;
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
      if (disposed) { reject(abortError()); return; }
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

  function dispose() {
    if (disposed) return;
    disposed = true;
    const pending = active ? [active, ...queue] : [...queue];
    active = null;
    queue.length = 0;
    if (worker) { try { worker.terminate(); } catch {} }
    worker = null;
    mode = "disposed";
    settleStart("disposed");
    const error = abortError();
    for (const job of pending) job.reject(error);
  }

  return Object.freeze({
    /** generateProgram(request, catalog), resolved off the main thread when possible. */
    generate: (request, { signal } = {}) => submit({ type: "generate", request }, signal),
    /** RepForgeProgramTransition.deriveSuccessor(input) against the release catalog; input carries no catalog. */
    derive: (input, { signal } = {}) => {
      const { catalogSnapshot, ...rest } = input || {};
      return submit({ type: "derive", input: rest }, signal);
    },
    /** Starts the worker if needed; resolves "worker" or "main" once that is known. */
    ready: () => start(),
    stats: () => ({ mode, ...counts }),
    /** Terminates this executor and rejects any active or queued jobs. */
    dispose,
  });
}
export default Object.freeze({create,url});
