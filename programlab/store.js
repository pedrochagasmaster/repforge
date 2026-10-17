(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./domain.js") : root.ProgramLabDomain;
  const DB_NAME = "taurifer_programlab_v1", DB_VERSION = 1;
  const unfinished = status => status === "validating" || status === "running";
  const summary = run => { const { records, ...metadata } = run; return D.snapshot(metadata); };

  function open() {
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Program Lab database upgrade is blocked by another tab"));
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("revisions", { keyPath: ["experimentId", "revision"] });
        db.createObjectStore("runs", { keyPath: "runId" }).createIndex("experimentId", "plan.experiment.experimentId");
        db.createObjectStore("cells", { keyPath: ["runId", "cellKey"] }).createIndex("runId", "runId");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        function transact(stores, mode, action) {
          return new Promise((resolveTransaction, rejectTransaction) => {
            const tx = db.transaction(stores, mode);
            let result, failure;
            const abort = error => { failure = error; try { tx.abort(); } catch {} };
            const guard = callback => event => { try { callback(event.target.result); } catch (error) { abort(error); } };
            tx.oncomplete = () => resolveTransaction(result);
            tx.onabort = () => rejectTransaction(failure || tx.error || new Error("Program Lab transaction aborted"));
            tx.onerror = () => { failure ||= tx.error; };
            try { action(tx, value => { result = value; }, guard, abort); } catch (error) { abort(error); }
          });
        }
        function begin(experiment, run) {
          const revision = D.snapshot(experiment), initial = D.snapshot(summary(run));
          if (!unfinished(initial.status) || initial.completed !== 0 || run.records.length !== 0
            || initial.total !== initial.plan.cells.length || D.digest(initial.plan.experiment) !== D.digest(revision)) return Promise.reject(new Error("Invalid initial run snapshot"));
          return transact(["revisions", "runs"], "readwrite", (tx, done, guard) => {
            const revisions = tx.objectStore("revisions"), runs = tx.objectStore("runs");
            revisions.get([revision.experimentId, revision.revision]).onsuccess = guard(previous => {
              if (previous && D.digest(previous) !== D.digest(revision)) throw new Error("Experiment revision is immutable");
              if (!previous) revisions.add(revision);
              runs.get(initial.runId).onsuccess = guard(previousRun => {
                if (previousRun) throw new Error("Run identity already exists");
                runs.add(initial); done(initial.runId);
              });
            });
          });
        }
        function checkpoint(runId, record) {
          const cell = D.snapshot(record);
          return transact(["runs", "cells"], "readwrite", (tx, done, guard) => {
            const runs = tx.objectStore("runs"), cells = tx.objectStore("cells");
            runs.get(runId).onsuccess = guard(run => {
              if (!run || !unfinished(run.status)) throw new Error("Run is not writable");
              if (!run.plan.cells.some(planned => planned.cellKey === cell.cellKey)) throw new Error("Cell is outside the run plan");
              cells.get([runId, cell.cellKey]).onsuccess = guard(previous => {
                if (previous) {
                  const { runId: ignored, ...saved } = previous;
                  if (D.digest(saved) !== D.digest(cell)) throw new Error("Cell outcomes are immutable");
                  done(run.completed); return;
                }
                cells.add({ ...cell, runId });
                run.completed++;
                if (run.completed > run.total) throw new Error("Run completeness overflow");
                runs.put(run); done(run.completed);
              });
            });
          });
        }
        function finalize(run) {
          const final = D.snapshot(summary(run));
          if (!["completed", "canceled", "failed", "interrupted"].includes(final.status)) return Promise.reject(new Error("Invalid final run state"));
          return transact(["runs"], "readwrite", (tx, done, guard) => {
            const runs = tx.objectStore("runs");
            runs.get(final.runId).onsuccess = guard(previous => {
              if (!previous || !unfinished(previous.status)) throw new Error("Run cannot be finalized twice");
              if (D.digest(previous.plan) !== D.digest(final.plan) || previous.completed !== final.completed
                || final.completed !== run.records.length || final.total !== previous.total
                || final.status === "completed" && final.completed !== final.total) throw new Error("Final run does not match committed checkpoints");
              runs.put(final); done(final.runId);
            });
          });
        }
        function loadRun(runId) {
          return transact(["runs", "cells"], "readonly", (tx, done, guard) => {
            tx.objectStore("runs").get(runId).onsuccess = guard(run => {
              if (!run) { done(null); return; }
              tx.objectStore("cells").index("runId").getAll(runId).onsuccess = guard(cells => {
                const byKey = new Map(cells.map(({ runId: ignored, ...cell }) => [cell.cellKey, cell]));
                const records = run.plan.cells.flatMap(cell => byKey.has(cell.cellKey) ? [byKey.get(cell.cellKey)] : []);
                if (records.length !== run.completed || cells.length !== records.length) throw new Error("Stored run completeness mismatch");
                done(Object.freeze({ ...D.snapshot(run), records: Object.freeze(records.map(record => D.snapshot(record))) }));
              });
            });
          });
        }
        function recoverInterrupted() {
          return transact(["runs"], "readwrite", (tx, done, guard) => {
            let recovered = 0;
            tx.objectStore("runs").openCursor().onsuccess = guard(cursor => {
              if (!cursor) { done(recovered); return; }
              if (unfinished(cursor.value.status)) { cursor.update({ ...cursor.value, status: "interrupted" }); recovered++; }
              cursor.continue();
            });
          });
        }
        function saveExperiment(experiment) {
          const revision = D.snapshot(experiment);
          return transact(["revisions"], "readwrite", (tx, done, guard) => {
            const revisions = tx.objectStore("revisions");
            revisions.get([revision.experimentId, revision.revision]).onsuccess = guard(previous => {
              if (previous && D.digest(previous) !== D.digest(revision)) throw new Error("Experiment revision is immutable");
              if (!previous) revisions.add(revision);
              done(revision);
            });
          });
        }
        function listExperiments() {
          return transact(["revisions"], "readonly", (tx, done, guard) => {
            tx.objectStore("revisions").getAll().onsuccess = guard(values => done(D.snapshot(values)));
          });
        }
        function listRuns(experimentId, revision) {
          return transact(["runs"], "readonly", (tx, done, guard) => {
            tx.objectStore("runs").index("experimentId").getAll(experimentId).onsuccess = guard(values => {
              const rows = values.filter(run => revision === undefined || run.plan.experiment.revision === revision)
                .map(run => ({ runId: run.runId, revision: run.plan.experiment.revision, status: run.status,
                  completed: run.completed, total: run.total, startedAt: run.startedAt || null }));
              rows.sort((a, b) => String(a.startedAt || "") < String(b.startedAt || "") ? 1
                : String(a.startedAt || "") > String(b.startedAt || "") ? -1 : a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0);
              done(D.snapshot(rows));
            });
          });
        }
        async function loadExperiment(experimentId, revision) {
          const all = await listExperiments();
          const matching = all.filter(value => value.experimentId === experimentId && (revision === undefined || value.revision === revision));
          return matching.sort((a, b) => b.revision - a.revision)[0] || null;
        }
        async function resolveRevision(experiment) {
          const input = D.snapshot(experiment), experimentId = input.experimentId || root.crypto.randomUUID();
          const latest = await loadExperiment(experimentId);
          const inputs = value => { const { revision, ...fields } = value; return fields; };
          if (latest && D.digest(inputs(latest)) === D.digest(inputs({ ...input, experimentId }))) return latest;
          const revision = latest ? latest.revision + 1 : 1;
          if (!Number.isSafeInteger(revision)) throw new Error("Experiment revision limit reached");
          // Read-only preparation. begin() adds this exact revision and the run in
          // one transaction, rejecting a concurrent conflicting revision safely.
          return D.snapshot({ ...input, experimentId, revision });
        }
        // Archive validators stage all records before this single transaction.
        function importArchive(validated, { experimentId = root.crypto.randomUUID(), runId = root.crypto.randomUUID() } = {}) {
          const source = D.snapshot(validated), external = source.experiment;
          const experiment = D.snapshot({ ...external, experimentId, revision: 1,
            provenance: { externalExperimentId: external.experimentId, externalRevision: external.revision,
              externalRunId: source.run?.runId || null } });
          const run = source.run ? D.snapshot({ ...source.run, runId, saved: true,
            status: unfinished(source.run.status) ? "interrupted" : source.run.status,
            plan: { ...source.run.plan, experiment }, archived: !!source.archived }) : null;
          return transact(["revisions", "runs", "cells"], "readwrite", (tx, done) => {
            tx.objectStore("revisions").add(experiment);
            if (run) {
              tx.objectStore("runs").add(summary(run));
              for (const cell of run.records) tx.objectStore("cells").add({ ...cell, runId });
            }
            done(D.snapshot({ experiment, run, archived: !!source.archived }));
          });
        }
        resolve(Object.freeze({ begin, checkpoint, finalize, loadRun, recoverInterrupted,
          saveExperiment, resolveRevision, listExperiments, listRuns, loadExperiment, importArchive, close: () => db.close() }));
      };
    });
  }
  const api = Object.freeze({ DB_NAME, DB_VERSION, open });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
