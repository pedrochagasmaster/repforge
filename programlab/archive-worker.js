/* Protocol only. A bundled, trusted worker entry imports its exact engine
   dependencies and calls install(createArchive). No archive supplies code URLs. */
(function (root) {
  "use strict";
  function createClient({ workerURL, WorkerClass = root.Worker, timeoutMs = 600000 }) {
    const worker = new WorkerClass(workerURL), pending = new Map();
    let sequence = 0, disposed = false;
    function terminate(error) {
      if (disposed) return;
      disposed = true; worker.terminate();
      for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
      pending.clear();
    }
    worker.onmessage = event => {
      const response = event.data;
      const job = pending.get(response?.id);
      if (!job || disposed) return;
      pending.delete(response.id); clearTimeout(job.timer);
      if (response.ok) job.resolve(response.value);
      else { const error = new Error(response.error?.message || "Archive validation failed"); error.code = response.error?.code || "invalid_archive"; job.reject(error); }
    };
    worker.onerror = event => terminate(new Error(event.message || "Archive worker failed"));
    function submit(operation, input, context) {
      if (disposed) return Promise.reject(new Error("Archive worker is disposed"));
      if (pending.size) return Promise.reject(new Error("An archive operation is already active"));
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => terminate(Object.assign(new Error("Archive worker timed out"), { code: "archive_timeout" })), timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try { worker.postMessage({ id, operation, input, context }); }
        catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
      });
    }
    return Object.freeze({ importArchive: (parts, context) => submit("import", parts, context),
      exportArchive: (experiment, run, context) => submit("export", { experiment, run }, context),
      dispose: () => terminate(Object.assign(new Error("Archive operation canceled"), { code: "archive_canceled" })) });
  }
  function install(createArchive) {
    let busy = false;
    root.onmessage = async event => {
      const request = event.data;
      const id = request?.id;
      try {
        if (!Number.isSafeInteger(id) || id < 1 || busy || !["import", "export"].includes(request.operation)
          || Object.keys(request).some(key => !["id", "operation", "input", "context"].includes(key))) throw new Error("Invalid archive worker request");
        busy = true;
        const archive = await createArchive(request.context);
        const value = request.operation === "import" ? await archive.importArchive(request.input)
          : archive.exportArchive(request.input.experiment, request.input.run);
        root.postMessage({ id, ok: true, value });
      } catch (error) { root.postMessage({ id, ok: false, error: { code: error.code || "invalid_archive", message: String(error.message || error) } }); }
      finally { busy = false; }
    };
  }
  const api = Object.freeze({ createClient, install });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabArchiveWorker = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
