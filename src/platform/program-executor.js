/**
 * @typedef {{enginePolicy?:unknown,diagnostics?:string}} GenerationOptions
 * @typedef {{ok:false,value:null,conflicts:unknown[],explanations:never[],diagnostics?:{kind:string,schemaVersion:number,version:string,terminalStage:string,slots:never[]}}} GenerationRefusal
 * @typedef {{ok:true,value:unknown}|{ok:false,issues:unknown[]}} PolicyNormalization
 */
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
/**
 * @template GRequest,GResult,DResult,Catalog
 * @template {object} DInput
 * @param {{compiler:{generateProgram:(request:GRequest,catalog:Catalog,options?:GenerationOptions)=>GResult,normalizeEnginePolicy?:(policy:unknown)=>PolicyNormalization},transition:{deriveSuccessor:(input:DInput & {catalogSnapshot:Catalog})=>DResult},catalog:()=>Catalog,WorkerConstructor?:typeof Worker|null,allowMainThreadFallback?:boolean,worker?:{url:string,catalogSha256:string,catalogUrl?:string}|null}} options
 */
export function create(options) {
  const opts = options || {};
  const WorkerConstructor=opts.WorkerConstructor || globalThis.Worker;
  /** @typedef {'pending'|'main'|'worker'|'failed'|'disposed'} Mode
   * @typedef {{type:'generate',request:GRequest,generationOptions?:GenerationOptions}|{type:'derive',input:DInput}} Work
   * @typedef {Work & {id:number,signal?:AbortSignal,resolve:(result:unknown)=>void,reject:(error:unknown)=>void}} Job
   */
  const counts = { worker: 0, main: 0 };
  /** @type {Job[]} */const queue = [];
  /** @type {Mode} */let mode = opts.worker && typeof WorkerConstructor === "function" ? "pending" : opts.allowMainThreadFallback===false ? "failed" : "main";
  /** @type {Worker|null} */let worker=null;
  /** @type {Promise<Mode>|null} */let started=null;
  /** @type {Job|null} */let active=null;
  let disposed=false;
  /** @type {(mode:Mode)=>void} */let settleStart = () => {};

  function workerUnavailable() {
    return Object.assign(new Error("The program worker is unavailable."), {name:"WorkerUnavailableError",code:"worker_unavailable"});
  }

  /** @param {Job} job */
  function runOnMain(job) {
    counts.main++;
    if (job.type === "generate") return opts.compiler.generateProgram(job.request, opts.catalog(),job.generationOptions);
    return opts.transition.deriveSuccessor({ ...job.input, catalogSnapshot: opts.catalog() });
  }

  // Once the worker is unusable every queued and future job runs here.
  function fallBack() {
    if (disposed) return;
    if (worker) { try { worker.terminate(); } catch {} }
    worker = null;
    mode = opts.allowMainThreadFallback===false ? "failed" : "main";
    settleStart(mode);
    const pending = active ? [active, ...queue] : [...queue];
    active = null;
    queue.length = 0;
    for (const job of pending) {
      if(mode==="failed")job.reject(workerUnavailable());
      else settle(job, () => runOnMain(job));
    }
  }

  /** @param {Job} job @param {()=>unknown} compute */
  function settle(job, compute) {
    if (job.signal?.aborted) { job.reject(abortError()); return; }
    try { job.resolve(compute()); } catch (error) { job.reject(error); }
  }

  /** @returns {Promise<Mode>} */
  function start() {
    if (started) return started;
    if (disposed) return Promise.resolve("disposed");
    started = new Promise((resolve) => { settleStart = resolve; });
    if (mode === "main" || mode==="failed") { settleStart(mode); return started; }
    try {
      worker = new (/** @type {typeof Worker} */(WorkerConstructor))(/** @type {{url:string}} */(opts.worker).url, { type: "module" });
    } catch {
      fallBack();
      return started;
    }
    worker.onerror = (event) => { event?.preventDefault?.(); fallBack(); };
    worker.onmessageerror = () => fallBack();
    worker.onmessage = (event) => {
      if (disposed || mode==="failed" || mode==="main") return;
      // Same-release dedicated worker messages are paired by the owned job id.
      const message = /** @type {{type?:string,id?:number,ok?:boolean,value?:unknown,message?:string}} */(event.data || {});
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
    try { worker.postMessage({ type: "init", catalogSha256: /** @type {{catalogSha256:string}} */(opts.worker).catalogSha256, catalogUrl: /** @type {{catalogUrl?:string}} */(opts.worker).catalogUrl }); } catch { fallBack(); }
    return started;
  }

  // One job at a time is in the worker, so a superseded job still waiting
  // here is dropped before it costs anything.
  function pump() {
    if (disposed) return;
    while (!active && queue.length) {
      const job = /** @type {Job} */(queue.shift());
      if (job.signal?.aborted) { job.reject(abortError()); continue; }
      if (mode === "main") { settle(job, () => runOnMain(job)); continue; }
      active = job;
      const { resolve, reject, signal, ...message } = job;
      try { /** @type {Worker} */(worker).postMessage(message); } catch { fallBack(); }
    }
  }

  let nextId = 0;
  /** @param {Work} job @param {AbortSignal} [signal] @returns {Promise<unknown>} */
  function submit(job, signal) {
    return new Promise((resolve, reject) => {
      if (disposed) { reject(abortError()); return; }
      if (signal?.aborted) { reject(abortError()); return; }
      if (mode==="failed") { reject(workerUnavailable()); return; }
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
    generate: /** @param {GRequest} request @param {GenerationOptions & {signal?:AbortSignal}} [options] @returns {Promise<GResult|GenerationRefusal>} */
    (request, { signal,enginePolicy,diagnostics } = {}) => {
      if(disposed || signal?.aborted)return Promise.reject(abortError());
      if(mode==='failed')return Promise.reject(workerUnavailable());
      if(diagnostics!==undefined && diagnostics!=='allocation-lineage@1')return Promise.resolve({ok:false,value:null,conflicts:[{field:'diagnostics',code:'invalid_diagnostics',message:'Choose allocation-lineage@1 or omit diagnostics.'}],explanations:[]});
      // Real generation compilers supply their own policy normalizer. Minimal
      // non-policy executors remain valid for the ordinary opaque job protocol.
      if(!opts.compiler.normalizeEnginePolicy && enginePolicy!==undefined)return Promise.reject(new TypeError('Compiler does not support engine policies'));
      const normalized=opts.compiler.normalizeEnginePolicy?.(enginePolicy);
      if(normalized && !normalized.ok)return Promise.resolve({ok:false,value:null,conflicts:[{field:'enginePolicy',code:'invalid_engine_policy',issues:normalized.issues}],explanations:[],
        ...(diagnostics===undefined?{}:{diagnostics:{kind:'taurifer-generation-diagnostics',schemaVersion:1,version:diagnostics,terminalStage:'validation',slots:[]}})});
      return /** @type {Promise<GResult>} */(submit({type:'generate',request,generationOptions:{enginePolicy:normalized?.value,...(diagnostics===undefined?{}:{diagnostics})}},signal));
    },
    /** RepForgeProgramTransition.deriveSuccessor(input) against the release catalog; input carries no catalog. */
    derive: /** @param {DInput & {catalogSnapshot?:unknown}} input @param {{signal?:AbortSignal}} [options] @returns {Promise<DResult>} */
    (input, { signal } = {}) => {
      const { catalogSnapshot, ...rest } = input || {};
      return /** @type {Promise<DResult>} */(submit({ type: "derive", input: /** @type {DInput} */(rest) }, signal));
    },
    /** Starts the worker if needed; resolves "worker", "main", or "failed" once that is known. */
    ready: () => start(),
    stats: () => ({ mode, ...counts }),
    /** Terminates this executor and rejects any active or queued jobs. */
    dispose,
  });
}
export default Object.freeze({create,url});
