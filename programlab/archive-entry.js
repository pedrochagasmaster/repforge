/* Packaged at the artifact root as programlab-archive-worker.js so the shared
   catalog loader resolves its original ./assets URL. No archive selects code. */
const waiting = [];
globalThis.onmessage = event => waiting.push(event);
(async function initializeArchiveWorker(root) {
  'use strict';
  try {
    const response = await fetch('./programlab/build-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Archive build manifest unavailable');
    const manifest = await response.json();
    if (manifest.kind !== 'taurifer-programlab-build' || manifest.schemaVersion !== 1
      || !Array.isArray(manifest.worker?.scripts) || manifest.worker.scripts.some(name => !/^[a-z0-9-]+\.js$/.test(name))) throw new Error('Invalid archive build manifest');
    root.RepForgeExercises = { library: [], catalogSha256: manifest.catalogSha256 };
    root.importScripts(...manifest.worker.scripts, './programlab/domain.js', './programlab/archive.js', './programlab/archive-worker.js');
    await root.RepForgeExerciseCatalog.load();
    const catalog = root.RepForgeExerciseCatalog.snapshot();
    const Compiler = root.RepForgeProgramCompiler, Policy = root.RepForgeEnginePolicy, D = root.ProgramLabDomain;
    const build = { runtimeFingerprint: manifest.runtimeFingerprint, catalogSha256: manifest.catalogSha256, diagnostics: manifest.diagnosticsVersion };
    root.ProgramLabArchiveWorker.install(context => {
      if (D.digest(context) !== D.digest(build)) throw new Error('Archive worker build context mismatch');
      return root.ProgramLabArchive.create({
        build, sweepPaths: Policy.getEnginePolicyMetadata().fields.map(field => field.path),
        validatePolicy: Policy.normalizeEnginePolicy,
        validateRequest: value => Compiler.normalizeProgramRequest(value, catalog),
        // Historical definitions use the engine's catalog-independent structural
        // boundary; their eligibility is never checked against today's catalog.
        validateProgram: (value, { archived }) => archived ? Compiler.validateProgramDefinitionStructure(value) : Compiler.validateProgramDefinition(value, catalog),
      });
    });
    // Requests received during asynchronous catalog verification wait for this
    // same trusted initialization, rather than being dropped by a late handler.
    for (const event of waiting) root.onmessage(event);
    waiting.length = 0;
  } catch (error) {
    const fail = event => root.postMessage({ id: event.data?.id, ok: false, error: { code: 'archive_initialization_failed', message: String(error.message || error) } });
    root.onmessage = fail;
    for (const event of waiting) fail(event);
    waiting.length = 0;
  }
})(globalThis);
