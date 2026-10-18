(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./domain.js") : root.ProgramLabDomain;
  const KIND = "taurifer-programlab-experiment", MANIFEST = "taurifer-programlab-archive-manifest";
  const bytes = value => new TextEncoder().encode(typeof value === "string" ? value : D.canonicalJSON(value)).length;
  const summary = run => { const { records, ...metadata } = run; return metadata; };
  const freeze = value => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const check = (condition, message, code = "invalid_archive") => { if (!condition) D.fail(code, message); };
  async function recordHash(value) {
    if (!root.crypto?.subtle) return D.digest(value);
    const encoded = new TextEncoder().encode(D.canonicalJSON(value));
    const hash = await root.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function create({ validatePolicy, validateRequest, validateProgram, build, sweepPaths = [] }) {
    check(typeof validatePolicy === "function" && typeof validateRequest === "function" && typeof validateProgram === "function", "Archive validators are required");
    function checked(validator, value, archived, label) {
      const result = validator(value, { archived });
      check(result?.ok === true, `Invalid archived ${label}`);
      return result.value ?? value;
    }
    function validateDiagnosticReferences(result, version) {
      if (result.ok && version === "allocation-lineage@1") check(result.diagnostics !== undefined, "Requested diagnostics are missing");
      if (result.diagnostics === undefined) return;
      const diagnostic = result.diagnostics;
      D.keys(diagnostic, ["kind", "schemaVersion", "version", "terminalStage", "slots"], ["allocation"]);
      check(diagnostic.kind === "taurifer-generation-diagnostics" && diagnostic.schemaVersion === 1
        && diagnostic.version === version && ["validation", "selection", "definition_validation", "complete"].includes(diagnostic.terminalStage)
        && Array.isArray(diagnostic.slots) && diagnostic.slots.length <= D.LIMITS.cells, "Invalid diagnostic schema/bounds");
      if (result.ok) check(diagnostic.terminalStage === "complete", "Successful program has incomplete diagnostics");
      const programSlots = new Map(), dayIds = new Set();
      if (result.ok) {
        check(Array.isArray(result.value?.days), "Invalid diagnostic program reference");
        for (const day of result.value.days) {
          dayIds.add(day.id);
          check(Array.isArray(day.slots), "Invalid diagnostic slot list");
          for (const slot of day.slots) programSlots.set(slot.id, { slot, dayId: day.id });
        }
      }
      const lineages = new Set(), retained = new Set(), slotIds = new Set();
      for (const record of diagnostic.slots) {
        D.keys(record, ["lineage", "origin", "purposeId", "slotId", "exerciseId", "repClass", "finalDayId", "baseSetCount", "afterExperienceSetCount", "finalSetCount", "retained", "initialDayId"]);
        for (const field of ["lineage", "origin", "purposeId", "slotId", "exerciseId"]) check(typeof record[field] === "string" && record[field].length > 0, "Invalid diagnostic identity");
        check(!lineages.has(record.lineage) && !slotIds.has(record.slotId) && typeof record.retained === "boolean", "Invalid or duplicate diagnostic lineage");
        lineages.add(record.lineage); slotIds.add(record.slotId);
        check(["first_push_lower", "first_pull", "secondary_push_lower", "secondary_pull", "assistance"].includes(record.repClass), "Invalid diagnostic rep class");
        for (const field of ["baseSetCount", "afterExperienceSetCount", "finalSetCount"]) check(Number.isSafeInteger(record[field]) && record[field] >= 0, "Invalid diagnostic set count");
        for (const field of ["initialDayId", "finalDayId"]) check(record[field] === null || typeof record[field] === "string" && record[field].length > 0, "Invalid diagnostic day identity");
        if (result.ok && record.initialDayId !== null) check(dayIds.has(record.initialDayId), "Unknown initial diagnostic day");
        if (result.ok && record.retained) {
          const actual = programSlots.get(record.slotId);
          check(actual && actual.dayId === record.finalDayId && actual.slot.exerciseId === record.exerciseId
            && actual.slot.purposeId === record.purposeId, "Diagnostic slot reference does not match the saved program");
          const ordinary = actual.slot.prescriptionsByCycle?.find(cycle => !(result.value.deloadCycles || []).includes(cycle.cycleIndex));
          if (ordinary) check(record.finalSetCount === ordinary.sets?.length, "Diagnostic set count does not match the saved prescriptions");
          retained.add(record.slotId);
        }
      }
      if (result.ok) check(retained.size === programSlots.size, "Diagnostics omit saved program slots");
      if (diagnostic.allocation !== undefined) {
        const allocation = diagnostic.allocation;
        D.keys(allocation, ["requestedMinutes", "budgetMinutes", "selected", "estimatedSecondsByDay"]);
        check(Number.isFinite(allocation.requestedMinutes) && allocation.requestedMinutes > 0
          && (allocation.budgetMinutes === null || Number.isFinite(allocation.budgetMinutes) && allocation.budgetMinutes > 0), "Invalid diagnostic allocation duration");
        check(allocation.estimatedSecondsByDay && typeof allocation.estimatedSecondsByDay === "object" && !Array.isArray(allocation.estimatedSecondsByDay)
          && Object.values(allocation.estimatedSecondsByDay).every(seconds => Number.isFinite(seconds) && seconds >= 0), "Invalid diagnostic allocation estimates");
        if (allocation.selected !== null) {
          D.keys(allocation.selected, ["upper", "lower"]);
          for (const region of Object.values(allocation.selected)) {
            D.keys(region, ["compound", "isolation"]);
            for (const counts of Object.values(region)) check(Array.isArray(counts) && counts.length === 4
              && counts.every(count => Number.isSafeInteger(count) && count >= 0), "Invalid diagnostic allocation counts");
          }
        }
        if (result.ok) {
          check(allocation.requestedMinutes === result.value.request.timeCeilingMinutes, "Diagnostic request duration does not match the saved program");
          check(allocation.budgetMinutes === result.value.provenance.generationBudgetMinutes
            && D.canonicalJSON(allocation.estimatedSecondsByDay) === D.canonicalJSON(result.value.provenance.estimatedSessionSeconds), "Diagnostic allocation estimates do not match the saved program");
        }
      }
    }
    function validate(experiment, run) {
      D.keys(experiment, ["experimentId", "revision", "name", "notes", "mode", "scenarios", "baselinePolicy", "candidatePolicy", "referenceTimePolicy", "sweep"], ["provenance"]);
      check(typeof experiment.name === "string" && typeof experiment.notes === "string", "Invalid experiment text");
      check(typeof experiment.experimentId === "string" && experiment.experimentId.length > 0 && Number.isSafeInteger(experiment.revision) && experiment.revision > 0, "Invalid experiment identity");
      check(Array.isArray(experiment.scenarios) && experiment.scenarios.length > 0 && experiment.scenarios.length <= D.LIMITS.pairs, "Scenario bound exceeded");
      check(["single", "batch", "sweep"].includes(experiment.mode), "Invalid experiment mode");
      if (experiment.sweep !== null) {
        D.keys(experiment.sweep, ["path", "values"]);
        check(experiment.mode === "sweep" && Array.isArray(experiment.sweep.values) && experiment.sweep.values.length > 0 && experiment.sweep.values.length <= D.LIMITS.sweepValues, "Sweep bound exceeded");
      } else check(experiment.mode !== "sweep", "Missing sweep definition");
      const archived = !!run && (run.plan.build.runtimeFingerprint !== build.runtimeFingerprint || run.plan.build.catalogSha256 !== build.catalogSha256);
      for (const policy of [experiment.baselinePolicy, experiment.candidatePolicy, experiment.referenceTimePolicy]) checked(validatePolicy, policy, archived, "policy");
      const ids = new Set();
      for (const scenario of experiment.scenarios) {
        D.keys(scenario, ["id", "name", "request"], ["inputMode", "answers", "seed"]);
        D.text(scenario.name, "scenario name");
        check(typeof scenario.id === "string" && scenario.id.length > 0 && !ids.has(scenario.id), "Duplicate or invalid scenario ID"); ids.add(scenario.id);
        if (!archived) checked(validateRequest, scenario.request, false, "request");
        if (scenario.request.seed !== undefined && scenario.seed !== undefined) check(scenario.request.seed === String(scenario.seed), "Contradictory effective request seed");
      }
      if (!run) return false;
      D.keys(run, ["kind", "schemaVersion", "runId", "plan", "status", "records", "completed", "total", "saved", "error"], ["archived", "startedAt", "finishedAt", "buildProvenance"]);
      check(run.kind === "taurifer-programlab-run" && run.schemaVersion === 1 && typeof run.runId === "string", "Unsupported run kind or version");
      check(typeof run.saved === "boolean" && run.runId.length > 0, "Invalid run metadata");
      for (const field of ["startedAt", "finishedAt"]) if (run[field] !== undefined && run[field] !== null) check(typeof run[field] === "string" && Number.isFinite(Date.parse(run[field])), "Invalid run timestamp");
      if (run.error !== null) { D.keys(run.error, ["code", "message"]); check(typeof run.error.code === "string" && typeof run.error.message === "string", "Invalid run error"); }
      check(["validating", "running", "completed", "canceled", "interrupted", "failed"].includes(run.status), "Invalid run status");
      check(Array.isArray(run.records) && run.records.length <= D.LIMITS.cells && run.records.length === run.completed, "Run completeness mismatch");
      const plan = run.plan;
      D.keys(plan, ["kind", "schemaVersion", "experiment", "build", "cells", "comparisons", "caseCount", "cellCount", "baselineReuse", "metricsVersion"]);
      D.keys(plan.build, ["runtimeFingerprint", "catalogSha256", "diagnostics"]);
      if (run.buildProvenance !== undefined) D.validateBuildProvenance(run.buildProvenance, plan.build);
      check(plan.kind === "taurifer-programlab-plan" && plan.schemaVersion === 1 && Array.isArray(plan.cells) && plan.cells.length > 0 && plan.cells.length <= D.LIMITS.cells, "Invalid planned cell bound");
      check(plan.metricsVersion === D.METRICS_VERSION && plan.cellCount === plan.cells.length && run.total === plan.cellCount && run.completed <= run.total, "Run plan completeness mismatch");
      check(run.status !== "completed" || run.completed === run.total, "Completed run is missing outcomes");
      check(D.digest(experiment) === D.digest(plan.experiment), "Run experiment snapshot mismatch");
      const planned = new Map();
      for (const cell of plan.cells) {
        D.keys(cell, ["cellKey", "request", "policy", "policyHash", "diagnostics"]);
        check(!planned.has(cell.cellKey), "Duplicate planned cell");
        check(cell.policyHash === D.digest(cell.policy), "Policy hash mismatch");
        checked(validatePolicy, cell.policy, archived, "cell policy");
        if (!archived) checked(validateRequest, cell.request, false, "cell request");
        check(cell.cellKey === D.digest({ cellSchemaVersion: 1, runtimeFingerprint: plan.build.runtimeFingerprint,
          catalogSha256: plan.build.catalogSha256, request: cell.request, policy: cell.policy, diagnostics: cell.diagnostics }) && cell.diagnostics === plan.build.diagnostics, "Cell identity hash mismatch");
        planned.set(cell.cellKey, cell);
      }
      check(Array.isArray(plan.comparisons) && plan.comparisons.length <= D.LIMITS.pairs * D.LIMITS.sweepValues, "Comparison bound exceeded");
      for (const comparison of plan.comparisons) {
        D.keys(comparison, ["scenarioId", "value", "baselineKey", "candidateKey", "comparisonKey"]);
        check(ids.has(comparison.scenarioId) && planned.has(comparison.baselineKey) && planned.has(comparison.candidateKey), "Broken comparison reference");
        check(comparison.comparisonKey === D.digest({ baselineKey: comparison.baselineKey, candidateKey: comparison.candidateKey,
          metricsVersion: D.METRICS_VERSION, referenceTimePolicy: experiment.referenceTimePolicy }), "Comparison hash mismatch");
        const scenario = experiment.scenarios.find(value => value.id === comparison.scenarioId);
        check(D.digest(planned.get(comparison.baselineKey).request) === D.digest(scenario.request)
          && D.digest(planned.get(comparison.candidateKey).request) === D.digest(scenario.request), "Comparison request mismatch");
      }
      // Recheck the entire planning contract without asking today's catalog to
      // normalize historical inputs or resolve historical eligibility.
      {
        const inferredPaths = experiment.sweep ? [experiment.sweep.path] : [];
        const expected = D.create({ normalizePolicy: value => ({ ok: true, value: checked(validatePolicy, value, archived, "policy") }),
          normalizeRequest: archived ? value => ({ ok: true, value }) : validateRequest, allowSeedLabels: archived,
          sweepPaths: sweepPaths.length && !archived ? sweepPaths : inferredPaths }).plan(experiment, plan.build);
        check(D.digest(expected) === D.digest(plan), "Saved plan does not match its complete inputs");
      }
      const seen = new Set();
      for (const record of run.records) {
        D.keys(record, ["cellKey", "outcome", "result", "resultJSON", "error"]);
        check(planned.has(record.cellKey) && !seen.has(record.cellKey), "Duplicate or unplanned cell outcome"); seen.add(record.cellKey);
        if (record.error !== null) {
          D.keys(record.error, ["code", "message"]);
          check(typeof record.error.code === "string" && typeof record.error.message === "string", "Invalid execution error");
          check(record.outcome === "execution_error" && record.result === null && record.resultJSON === null, "Execution error outcome mismatch"); continue;
        }
        const result = record.result;
        D.keys(result, ["ok", "value", "conflicts", "explanations"], ["confirmationOffers", "diagnostics"]);
        check(Array.isArray(result.conflicts) && Array.isArray(result.explanations)
          && (result.confirmationOffers === undefined || Array.isArray(result.confirmationOffers)), "Malformed generation result lists");
        check(typeof record.resultJSON === "string" && D.canonicalJSON(JSON.parse(record.resultJSON)) === D.canonicalJSON(result), "Original result JSON mismatch");
        check(record.outcome === D.classify(result), "Cell outcome mismatch");
        validateDiagnosticReferences(result, run.plan.build.diagnostics);
        if (result.ok) {
          checked(validateProgram, result.value, archived, "program envelope");
          const cell = planned.get(record.cellKey);
          check(D.digest(result.value.request) === D.digest(cell.request), "Input/result request mismatch");
          if (result.value.seed !== undefined || cell.request.seed !== undefined) check(result.value.seed === cell.request.seed, "Input/result seed mismatch");
        } else check(result.ok === false && result.value === null, "Invalid failed result envelope");
      }
      return archived;
    }
    async function exportArchive(experiment, run = null, { partBytes = D.LIMITS.partBytes, exportedAt = new Date().toISOString() } = {}) {
      check(Number.isSafeInteger(partBytes) && partBytes > 0 && partBytes <= D.LIMITS.partBytes, "Invalid archive part limit");
      const records = run?.records || [];
      check(Array.isArray(records) && records.length <= D.LIMITS.cells, "Cell bound exceeded");
      // Size preflight precedes detailed record hashing, including rejection of
      // a locally saved cell that cannot fit into any supported archive part.
      const recordSizes = records.map(record => bytes(record));
      check(recordSizes.every(size => size <= partBytes), "One cell exceeds the individual file bound; export configuration only", "archive_too_large");
      validate(experiment, run);
      const shared = { exportedAt, experiment, run: run ? summary(run) : null };
      const metadataHash = D.digest(shared);
      const hashes = [];
      for (const record of records) hashes.push({ cellKey: record.cellKey, hash: await recordHash(record) });
      const envelope = (group, index, count, manifest) => ({ kind: KIND, schemaVersion: 1, exportedAt, experiment,
        runs: run ? [{ ...shared.run, records: group }] : [], transfer: { archiveId: D.digest(manifest), partIndex: index, partCount: count, manifest } });
      const worstManifest = { kind: MANIFEST, schemaVersion: 1, metadataHash, partCount: 10, records: hashes.map(entry => ({ ...entry, partIndex: 10 })) };
      const overhead = bytes(envelope([], 10, 10, worstManifest));
      const singleManifest = { kind: MANIFEST, schemaVersion: 1, metadataHash, partCount: 1, records: hashes.map(entry => ({ ...entry, partIndex: 1 })) };
      const singleFits = bytes(envelope([], 1, 1, singleManifest)) + recordSizes.reduce((sum, size) => sum + size, 0) + Math.max(0, records.length - 1) <= partBytes;
      check(singleFits || overhead <= partBytes, "Shared archive metadata exceeds the individual file bound; export configuration only", "archive_too_large");
      const groups = singleFits ? [records] : [[]]; let used = overhead;
      if (!singleFits) for (const [index, record] of records.entries()) {
        const size = recordSizes[index] + 1;
        check(overhead + size <= partBytes, "One cell exceeds the individual file bound; export configuration only", "archive_too_large");
        if (used + size > partBytes) { groups.push([]); used = overhead; }
        groups.at(-1).push(record); used += size;
      }
      check(groups.length <= D.LIMITS.parts, "Full-results archive exceeds 10 parts; export configuration only", "archive_too_large");
      const assignments = new Map(groups.flatMap((group, index) => group.map(record => [record.cellKey, index + 1])));
      const manifest = { kind: MANIFEST, schemaVersion: 1, metadataHash, partCount: groups.length,
        records: hashes.map(entry => ({ ...entry, partIndex: assignments.get(entry.cellKey) })) };
      let total = 0;
      return groups.map((group, index) => {
        const encoded = D.canonicalJSON(envelope(group, index + 1, groups.length, manifest)), size = bytes(encoded); total += size;
        check(size <= partBytes && total <= D.LIMITS.totalBytes, "Archive encoded size exceeds limits", "archive_too_large");
        return { name: `programlab-${D.digest(manifest).slice(0, 12)}-${index + 1}-of-${groups.length}.json`, text: encoded, size };
      });
    }
    async function importArchive(parts) {
      check(Array.isArray(parts) && parts.length > 0 && parts.length <= D.LIMITS.parts, "Invalid archive part count", "incomplete_archive");
      let total = 0;
      for (const part of parts) {
        const size = typeof part === "string" ? bytes(part) : part.size;
        check(Number.isSafeInteger(size) && size >= 0 && size <= D.LIMITS.partBytes, "Archive file exceeds 50 MiB", "archive_too_large");
        total += size; check(total <= D.LIMITS.totalBytes, "Archive total exceeds 500 MiB", "archive_too_large");
      }
      let manifest, shared, archiveId;
      const indexes = new Set(), records = new Map();
      for (const file of parts) {
        const encoded = typeof file === "string" ? file : await file.text();
        check(bytes(encoded) <= D.LIMITS.partBytes, "Archive file exceeds encoded size limit", "archive_too_large");
        const part = JSON.parse(encoded);
        D.keys(part, ["kind", "schemaVersion", "exportedAt", "experiment", "runs", "transfer"]);
        check(part.kind === KIND && part.schemaVersion === 1 && typeof part.exportedAt === "string", "Unknown archive kind/version");
        D.keys(part.transfer, ["archiveId", "partIndex", "partCount", "manifest"]);
        const transfer = part.transfer;
        D.keys(transfer.manifest, ["kind", "schemaVersion", "metadataHash", "partCount", "records"]);
        check(transfer.manifest.kind === MANIFEST && transfer.manifest.schemaVersion === 1
          && Array.isArray(transfer.manifest.records) && transfer.manifest.records.length <= D.LIMITS.cells, "Invalid manifest schema/bounds");
        check(Number.isInteger(transfer.partCount) && transfer.partCount >= 1 && transfer.partCount <= D.LIMITS.parts
          && transfer.partCount === transfer.manifest.partCount && Number.isInteger(transfer.partIndex)
          && transfer.partIndex >= 1 && transfer.partIndex <= transfer.partCount && !indexes.has(transfer.partIndex), "Duplicate or invalid part index", "incomplete_archive");
        check(parts.length === transfer.partCount, "Select every declared archive part", "incomplete_archive");
        check(Array.isArray(part.runs) && part.runs.length <= 1, "Only one selected run is supported");
        check(!part.runs.length || Array.isArray(part.runs[0].records) && part.runs[0].records.length <= D.LIMITS.cells, "Cell bound exceeded");
        check(Array.isArray(part.experiment.scenarios) && part.experiment.scenarios.length <= D.LIMITS.pairs, "Scenario bound exceeded");
        if (part.experiment.sweep) check(Array.isArray(part.experiment.sweep.values) && part.experiment.sweep.values.length <= D.LIMITS.sweepValues, "Sweep bound exceeded");
        if (part.runs.length) check(Array.isArray(part.runs[0].plan.cells) && part.runs[0].plan.cells.length <= D.LIMITS.cells, "Planned cell bound exceeded");
        D.canonicalJSON(part); // Bounds and depth/plain-data guards precede hashing/rendering.
        const metadata = { exportedAt: part.exportedAt, experiment: part.experiment, run: part.runs[0] ? summary(part.runs[0]) : null };
        check(D.digest(metadata) === transfer.manifest.metadataHash, "Shared metadata hash mismatch");
        check(D.digest(transfer.manifest) === transfer.archiveId, "Archive manifest hash mismatch");
        if (!manifest) { manifest = transfer.manifest; shared = metadata; archiveId = transfer.archiveId; }
        else check(archiveId === transfer.archiveId && D.digest(manifest) === D.digest(transfer.manifest), "Parts have different manifests");
        indexes.add(transfer.partIndex);
        for (const record of part.runs[0]?.records || []) {
          check(!records.has(record.cellKey), "Duplicate cell record");
          const declared = manifest.records.find(entry => entry.cellKey === record.cellKey);
          check(declared && declared.partIndex === transfer.partIndex && declared.hash === await recordHash(record), "Cell record hash or part assignment mismatch");
          records.set(record.cellKey, record);
        }
      }
      check(indexes.size === manifest.partCount && records.size === manifest.records.length, "Select every declared archive part and cell", "incomplete_archive");
      const declarations = new Set();
      for (const entry of manifest.records) {
        D.keys(entry, ["cellKey", "hash", "partIndex"]);
        check(!declarations.has(entry.cellKey) && records.has(entry.cellKey), "Duplicate or missing manifest cell", "incomplete_archive"); declarations.add(entry.cellKey);
      }
      const run = shared.run ? { ...shared.run, records: manifest.records.map(entry => records.get(entry.cellKey)) } : null;
      check(run !== null || records.size === 0, "Configuration archive cannot contain run outcomes");
      const archived = validate(shared.experiment, run);
      return freeze({ experiment: shared.experiment, run, archived, exactReplayAvailable: !archived });
    }
    return Object.freeze({ exportArchive, importArchive, validateSnapshot: validate });
  }
  const api = Object.freeze({ create, KIND, MANIFEST });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabArchive = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
