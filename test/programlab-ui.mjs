#!/usr/bin/env node
// Production-backed Program Lab journey. Requires the packaged shared modules;
// this suite must never substitute a mock engine or persistence layer.
import assert from 'node:assert/strict';
import { mkdir, writeFile, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgramLab } from '../tools/build-programlab.mjs';
import { launchChromium } from './browser.mjs';
import { maybeStartLocalPreview } from '../tools/local-preview.mjs';
const base = process.env.REPFORGE_URL || 'http://localhost:8000/';
let lab = new URL('programlab/', base).href;
const artifacts = process.env.REPFORGE_ARTIFACT_DIR || path.resolve('.ci-results/programlab-ui');
await mkdir(artifacts, { recursive: true });
let artifactPreview = null;
if (process.env.REPFORGE_PROGRAMLAB_URL) lab = process.env.REPFORGE_PROGRAMLAB_URL;
else {
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const parent = path.join(repository, '.ci-results');
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, 'programlab-artifact-'));
  const outDir = path.join(staging, 'artifact');
  const manifest = await buildProgramLab({ outDir });
  await writeFile(path.join(artifacts, 'packaged-build.json'), JSON.stringify({ sourceCommit: manifest.sourceCommit, runtimeFingerprint: manifest.runtimeFingerprint, catalogSha256: manifest.catalogSha256, generatorVersion: manifest.generatorVersion, artifact: outDir }, null, 2));
  artifactPreview = await maybeStartLocalPreview([{ lane: 'entry' }], { cwd: outDir,
    prepareApp: false, env: { ...process.env, REPFORGE_URL: '' } });
  lab = artifactPreview.env.REPFORGE_URL;
  assert.notEqual(new URL(lab).origin, new URL(base).origin, 'packaged lab has a separate origin from production preview');
}
async function selectedComparison(page, previousId = null) {
  if (!await page.locator('#rawDetails').evaluate(element => element.open)) await page.locator('#rawDetails summary').click();
  await page.waitForFunction(previous => {
    try { const value = JSON.parse(document.getElementById('rawResult').textContent); return value.runId && value.runId !== previous; }
    catch { return false; }
  }, previousId);
  return JSON.parse(await page.locator('#rawResult').textContent());
}
async function executeAndInspect(page, previousId = null) {
  await page.locator('#run').click();
  await page.locator('#runStatus').filter({ hasText: 'completed' }).waitFor({ timeout: 120000 });
  return selectedComparison(page, previousId);
}
async function historicalArchive(page, envelope, unknownCatalogId) {
  return page.evaluate(async ({ envelope, unknownCatalogId }) => {
    const D = window.ProgramLabDomain, Policy = window.RepForgeEnginePolicy;
    const experiment = structuredClone(envelope.experiment), source = structuredClone(envelope.runs[0]);
    const previousCells = source.plan.cells;
    const historicalId = 'f'.repeat(32);
    if (window.RepForgeExerciseCatalog.snapshot().uuidIndex[historicalId]) throw new Error('Historical fixture ID must be absent from this catalog');
    const exerciseId = source.records.find(record => record.result?.ok).result.value.days.flatMap(day => day.slots)[0].exerciseId;
    function replace(value) {
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [unknownCatalogId && key === exerciseId ? historicalId : key, replace(item)]));
      return unknownCatalogId && value === exerciseId ? historicalId : value;
    }
    for (const scenario of experiment.scenarios) {
      scenario.request = replace(scenario.request);
      if (unknownCatalogId) scenario.request.executionContexts[historicalId] = 'bilateral';
    }
    const provenance = source.buildProvenance;
    provenance.sourceHashes['program-compiler.js'] = '3'.repeat(64);
    provenance.sourceHashes['assets/exercise-catalog.json'] = '2'.repeat(64);
    provenance.sourceCommit = null; provenance.dirty = null;
    const build = { ...source.plan.build, runtimeFingerprint: D.digest(provenance.runtimeFiles.map(name => [name, provenance.sourceHashes[name]])), catalogSha256: provenance.sourceHashes['assets/exercise-catalog.json'] };
    // Author a structurally coherent historical fixture with the public planner.
    // Historical inputs deliberately bypass current catalog normalization here;
    // the actual worker archive validator must still validate their structure.
    const planner = D.create({ normalizePolicy: Policy.normalizeEnginePolicy, normalizeRequest: value => ({ ok: true, value }), sweepPaths: Policy.getEnginePolicyMetadata().fields.map(field => field.path) });
    const plan = planner.plan(experiment, build);
    source.records = source.records.map(record => {
      const index = previousCells.findIndex(cell => cell.cellKey === record.cellKey), cell = plan.cells[index];
      const result = replace(JSON.parse(record.resultJSON));
      if (result.ok) result.value.request = structuredClone(cell.request);
      return { ...record, cellKey: cell.cellKey, result, resultJSON: JSON.stringify(result) };
    });
    source.plan = plan;
    const response = await fetch(new URL('programlab/build-manifest.json', document.baseURI));
    const manifest = await response.json();
    const client = window.ProgramLabArchiveWorker.createClient({ workerURL: new URL(manifest.archiveWorker.url, document.baseURI).href });
    try {
      return await client.exportArchive(plan.experiment, source, { runtimeFingerprint: manifest.runtimeFingerprint, catalogSha256: manifest.catalogSha256, diagnostics: manifest.diagnosticsVersion });
    } finally { client.dispose(); }
  }, { envelope, unknownCatalogId });
}
async function exerciseHistoricalArchives(page) {
  const envelope = JSON.parse(await readFile(path.join(artifacts, 'experiment.json'), 'utf8'));
  const parts = await historicalArchive(page, envelope, false);
  assert.equal(parts.length, 1);
  await page.locator('#importFiles').setInputFiles({ name: parts[0].name, mimeType: 'application/json', buffer: Buffer.from(parts[0].text) });
  await page.locator('#persistenceStatus').filter({ hasText: 'Imported archived result' }).waitFor();
  assert(await page.locator('#run').isDisabled(), 'exact replay is disabled for mismatched fingerprints');
  assert(await page.locator('#runWithBuild').isVisible());
  const archived = await selectedComparison(page);
  await page.locator('#runWithBuild').click();
  await page.locator('#runStatus').filter({ hasText: 'completed' }).waitFor({ timeout: 30000 });
  const retargeted = await selectedComparison(page, archived.runId);
  assert.notEqual(retargeted.configuration.experimentId, archived.configuration.experimentId, 'run with this build creates a new experiment identity');
  assert.equal(retargeted.configuration.provenance.parentExperimentId, archived.configuration.experimentId);
  assert(await page.locator('#archiveActions').isHidden());
  const unknown = await historicalArchive(page, envelope, true);
  await page.locator('#importFiles').setInputFiles({ name: unknown[0].name, mimeType: 'application/json', buffer: Buffer.from(unknown[0].text) });
  await page.locator('#persistenceStatus').filter({ hasText: 'Imported archived result' }).waitFor();
  const historical = await selectedComparison(page, retargeted.runId);
  assert.match(await page.locator('#baselineProgram').textContent(), /f{32}/, 'historical exercise IDs remain viewable through the real structural validator');
  const before = await page.locator('#savedExperiments option').count();
  await page.locator('#runWithBuild').click();
  await page.locator('#fatalError').filter({ hasText: /canonical|request|scenario/i }).waitFor();
  assert.equal((await selectedComparison(page)).runId, historical.runId, 'failed current-catalog validation preserves the archived run');
  assert.equal(await page.locator('#savedExperiments option').count(), before);
  await page.screenshot({ path: path.join(artifacts, 'historical-unknown-id.png'), fullPage: true });
  console.log('Program Lab historical archives: fingerprint mismatch, read-only identity, new-build attempt and unknown catalog IDs through the shared structural boundary passed.');
}
async function exerciseCorpus(page, browserVersion, workers) {
  await page.locator('html[data-lab-ready="true"]').waitFor({ timeout: 20000 });
  await page.locator('[data-mode="batch"]').click();
  await page.locator('#fixture').selectOption('compiler-corpus');
  await page.locator('#preset').selectOption('two_sets_low_rir@1');
  await page.locator('#applyPreset').click();
  await page.evaluate(() => {
    const sample = window.__corpusFrames = { frames: 0, maxGapMs: 0, last: performance.now(), running: true };
    function tick(now) { sample.frames++; sample.maxGapMs = Math.max(sample.maxGapMs, now - sample.last); sample.last = now; if (sample.running) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });
  const started = performance.now();
  await page.locator('#run').click();
  await page.locator('#runStatus').filter({ hasText: 'completed' }).waitFor({ timeout: 900000 });
  const selected = await selectedComparison(page);
  const proof = await page.evaluate(async runId => {
    window.__corpusFrames.running = false;
    const { run } = await window.RepForgeProgramLabServices.loadRun(runId);
    const candidates = new Set(run.plan.comparisons.map(item => item.candidateKey));
    const counts = {}, violations = [];
    let candidateSuccesses = 0, checkedSets = 0;
    for (const record of run.records) {
      counts[record.outcome] = (counts[record.outcome] || 0) + 1;
      if (!candidates.has(record.cellKey) || !record.result?.ok) continue;
      candidateSuccesses++;
      const program = record.result.value;
      for (const day of program.days.filter(day => day.kind === 'training')) for (const slot of day.slots) {
        for (const cycle of slot.prescriptionsByCycle) {
          if ((program.deloadCycles || []).includes(cycle.cycleIndex)) continue;
          if (cycle.sets.length !== 2) violations.push({ cellKey: record.cellKey, exerciseId: slot.exerciseId, cycleIndex: cycle.cycleIndex, sets: cycle.sets.length });
          checkedSets += cycle.sets.length;
          for (const set of cycle.sets) if (set.rir !== null && ![0, 1].includes(set.rir)) violations.push({ cellKey: record.cellKey, rir: set.rir });
        }
      }
    }
    return { status: run.status, scenarios: run.plan.experiment.scenarios.length, planned: run.total,
      completed: run.completed, uniqueRecords: new Set(run.records.map(record => record.cellKey)).size,
      counts, candidateSuccesses, checkedSets, violations, frames: window.__corpusFrames };
  }, selected.runId);
  const evidence = { ...proof, elapsedMs: performance.now() - started, browser: browserVersion, node: process.version,
    platform: process.platform, workerURLs: [...new Set(workers)] };
  await writeFile(path.join(artifacts, 'corpus.json'), JSON.stringify(evidence, null, 2));
  assert.equal(proof.scenarios, 180);
  assert.equal(proof.status, 'completed');
  assert.equal(proof.completed, proof.planned);
  assert.equal(proof.uniqueRecords, proof.planned);
  assert.equal(proof.counts.execution_error || 0, 0);
  assert.equal(proof.counts.invalid_input || 0, 0);
  assert(proof.candidateSuccesses > 0 && proof.checkedSets > 0);
  assert.deepEqual(proof.violations, [], 'every successful candidate has two ordinary-cycle sets and low/native null RIR');
  assert(workers.some(url => url.includes('program-engine.js')), 'corpus uses actual generation worker');
  console.log(`Program Lab corpus: ${proof.scenarios} scenarios, ${proof.completed} distinct two-policy cells, ${JSON.stringify(proof.counts)}, ${(evidence.elapsedMs / 1000).toFixed(1)}s; browser ${browserVersion}.`);
}
async function exerciseModes(page) {
  await page.locator('html[data-lab-ready="true"]').waitFor({ timeout: 20000 });
  await page.locator('[data-mode="single"]').click();
  await page.locator('#fixture').selectOption('production-answers');
  await page.locator('#preset').selectOption('two_sets_low_rir@1');
  await page.locator('#applyPreset').click();
  const single = await executeAndInspect(page);
  await page.locator('[data-mode="batch"]').click();
  await page.locator('#duplicateScenario').click();
  await page.locator('[data-scenario-path="daysPerWeek"]').selectOption('3');
  await page.locator('#updateScenario').click();
  const batch = await executeAndInspect(page, single.runId);
  assert.equal(batch.baseline.cellKey, single.baseline.cellKey, 'single/batch baseline computation identity agrees');
  assert.equal(batch.candidate.cellKey, single.candidate.cellKey, 'single/batch candidate computation identity agrees');
  assert.equal(batch.candidate.resultJSON, single.candidate.resultJSON, 'single/batch preserve exact complete compiler bytes');
  assert.equal(await page.locator('#resultCase option').count(), 2);
  await page.locator('[data-mode="sweep"]').click();
  await page.locator('#sweepPath').selectOption('volume.setsByType.primary');
  await page.locator('#sweepValues').fill('2, 3');
  const sweep = await executeAndInspect(page, batch.runId);
  assert.equal(sweep.candidate.cellKey, single.candidate.cellKey, 'sweep scalar value two preserves the same candidate identity');
  assert.equal(sweep.candidate.resultJSON, single.candidate.resultJSON, 'single/batch/sweep exact results agree');
  assert.equal(await page.locator('#resultCase option').count(), 4, 'complete two-case/two-value sweep is planned');
  assert.equal(await page.locator('#aggregateSummary .result-table tbody tr').count(), 2, 'sweep renders one row per declared value');
  await page.screenshot({ path: path.join(artifacts, 'sweep-wide.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'real results and sweep table fit narrow layout');
  await page.screenshot({ path: path.join(artifacts, 'sweep-narrow.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-mode="batch"]').click();
  await page.locator('#fixture').selectOption('compiler-corpus');
  await page.locator('#run').click();
  await page.waitForFunction(() => Number(document.getElementById('progress').value) > 0 && document.getElementById('cancel').disabled === false);
  const cancelStart = performance.now();
  await page.evaluate(() => { window.__programlabCancellationProof.cancelNextGenerate = true; });
  await page.locator('#runStatus').filter({ hasText: /Cancellation acknowledged|canceled/ }).waitFor({ timeout: 30000 });
  const automationMs = performance.now() - cancelStart;
  const audit = await page.evaluate(() => window.__programlabCancellationProof);
  const acknowledgmentMs = audit.acknowledgedAt - audit.clickAt;
  const terminationMs = audit.terminatedAt - audit.clickAt;
  await writeFile(path.join(artifacts, 'cancellation.json'), JSON.stringify({ environment: process.platform, node: process.version, automationMs, acknowledgmentMs, terminationMs, audit }, null, 2));
  assert(audit.pendingAtTermination > 0, 'cancellation terminates an actual outstanding compiler job');
  assert(audit.terminatedAt !== null && terminationMs >= 0 && terminationMs < 1000, `native worker terminated in ${terminationMs.toFixed(0)}ms from the click event`);
  assert(audit.acknowledgedAt !== null && acknowledgmentMs >= 0 && acknowledgmentMs < 1000, `cancellation acknowledged in ${acknowledgmentMs.toFixed(0)}ms from the click event`);
  await page.locator('#runStatus').filter({ hasText: 'canceled' }).waitFor({ timeout: 30000 });
  const partial = await selectedComparison(page, sweep.runId);
  assert.equal(partial.status, 'canceled');
  assert(await page.locator('#progress').evaluate(element => element.value < element.max), 'cancellation preserves a partial run');
  assert.equal(await page.locator('#cancel').isDisabled(), true);
  await page.locator('[data-mode="sweep"]').click();
  await page.locator('#sweepPath').selectOption('timeModel.lowerRestSeconds');
  await page.locator('#sweepValues').fill(Array.from({ length: 20 }, (_, index) => index).join(', '));
  await page.locator('#validation').filter({ hasText: '1000' }).waitFor();
  assert(await page.locator('#run').isDisabled(), '180 cases times 20 values is rejected before execution');
  console.log(`Program Lab modes: exact single/batch/sweep parity, native three-day scenario editing, shared-cohort table, cell bound and real cancellation (${acknowledgmentMs.toFixed(0)}ms) passed.`);
}
let browser;
try {
  browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const production = await context.newPage();
  await production.goto(base);
  await production.waitForFunction(() => window.__repforgeBooted === true);
  const productionBefore = await production.evaluate(async () => {
    await window.__repforgeStorage.flush();
    localStorage.setItem('repforge_programlab_acceptance_sentinel', 'preserve-production');
    return { program: localStorage.getItem('repforge_v1'), sentinel: localStorage.getItem('repforge_programlab_acceptance_sentinel') };
  });
  const page = await context.newPage();
  const errors = [];
  const workers = [];
  await page.addInitScript(() => {
    const audit = { clickAt: null, handledAt: null, terminatedAt: null, acknowledgedAt: null, pendingAtTermination: 0, cancelNextGenerate: false };
    window.__programlabCancellationProof = audit;
    const terminate = Worker.prototype.terminate, post = Worker.prototype.postMessage;
    const pending = new WeakMap();
    Worker.prototype.postMessage = function(message, ...rest) {
      if (!pending.has(this)) { const ids = new Set(); pending.set(this, ids); this.addEventListener('message', event => ids.delete(event.data?.id)); }
      if (message?.type === 'generate') pending.get(this).add(message.id);
      const returned = post.call(this, message, ...rest);
      // Activate the real cancel button at a deterministic active-job boundary;
      // do not substitute a fake worker or invoke the runner directly.
      if (message?.type === 'generate' && audit.cancelNextGenerate) {
        audit.cancelNextGenerate = false;
        queueMicrotask(() => document.getElementById('cancel').click());
      }
      return returned;
    };
    Worker.prototype.terminate = function() { if (audit.clickAt !== null) { audit.terminatedAt = performance.now(); audit.pendingAtTermination = pending.get(this)?.size || 0; } return terminate.call(this); };
    document.addEventListener('click', event => {
      if (!event.target.closest?.('#cancel')) return;
      audit.clickAt = event.timeStamp; audit.handledAt = performance.now(); audit.terminatedAt = null; audit.acknowledgedAt = null;
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
      const status = document.getElementById('runStatus');
      new MutationObserver(() => {
        if (audit.clickAt !== null && audit.acknowledgedAt === null && /Cancellation acknowledged|canceled/.test(status.textContent)) audit.acknowledgedAt = performance.now();
      }).observe(status, { childList: true, subtree: true, characterData: true });
    });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  if (process.argv.includes('--shell')) await page.route('**/programlab/services.js', route => route.abort());
  await page.goto(lab);
  if (process.argv.includes('--shell')) {
    await page.locator('#fatalError').filter({ hasText: 'missing the lab integration services' }).waitFor();
    assert(await page.locator('#run').isDisabled(), 'missing integration fails closed');
    for (const width of [1440, 720, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `shell has no page overflow at ${width}px`);
      const labels = await page.locator('input,select,textarea').evaluateAll(controls => controls.filter(control => !control.labels?.length && !control.getAttribute('aria-label')).map(control => control.id));
      assert.deepEqual(labels, [], 'all shell controls have accessible labels');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip').evaluate(element => element === document.activeElement), width === 1440, 'keyboard skip link is reachable');
      await page.screenshot({ path: path.join(artifacts, `shell-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'shell supports 200% enlarged text without page overflow');
    await page.screenshot({ path: path.join(artifacts, 'shell-text-200.png'), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.locator('.skip').focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).pathname, new URL(lab).pathname, 'skip link stays in the lab despite document base');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'workbench', 'skip link moves focus to main');
    await page.locator('#experimentName').fill('Keep this draft / manter rascunho');
    await page.getByText('Advanced canonical request', { exact: true }).click();
    await page.locator('#canonicalRequest').fill('{"pending":true}');
    await page.locator('#language').selectOption('pt');
    await page.locator('html[lang="pt"]').waitFor();
    assert.equal(await page.locator('#run').textContent(), 'Executar comparação');
    assert.equal(await page.locator('#experimentName').inputValue(), 'Keep this draft / manter rascunho', 'language change preserves the name draft');
    assert.equal(await page.locator('#canonicalRequest').inputValue(), '{"pending":true}', 'language change preserves unapplied JSON');
    await page.screenshot({ path: path.join(artifacts, 'shell-pt.png'), fullPage: true });
    assert.match(await page.locator('#fatalError').textContent(), /módulos compartilhados/);
    await page.reload();
    await page.locator('html[lang="pt"]').waitFor();
    assert.equal(await page.locator('#language').inputValue(), 'pt', 'lab language survives reload');
    await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'real results remain usable with 200% enlarged text');
  assert(await page.locator('#policyControls input:visible').evaluateAll(controls => controls.every(control => control.getBoundingClientRect().width >= 44)), 'enlarged policy inputs retain an editable target');
  await page.screenshot({ path: path.join(artifacts, 'real-text-200.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('repforge'))), [], 'language preference never touches production keys');
    await page.locator('#language').selectOption('en');
    await page.locator('html[lang="en"]').waitFor();
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    assert.deepEqual(errors, []);
    console.log('Program Lab shell: missing integration blocks run; labels, same-page keyboard skip, 1440/720/390 layouts, 200% enlarged text, English/Portuguese draft preservation and storage isolation passed. Full worker journey remains pending.');
    await context.close();
  } else if (process.argv.includes('--corpus')) {
    await exerciseCorpus(page, browser.version(), workers);
    assert.deepEqual(errors, []);
    await context.close();
  } else if (process.argv.includes('--modes')) {
    await exerciseModes(page);
    assert.deepEqual(errors, []);
    await context.close();
  } else {
  await page.locator('html[data-lab-ready="true"]').waitFor({ timeout: 20000 });
  assert.match(await page.locator('#buildIdentity').textContent(), /Generator [0-9]/);
  await page.locator('#experimentName').fill('Browser proof: two sets');
  await page.locator('#fixture').selectOption('anchor-4day');
  await page.locator('#preset').selectOption('two_sets_low_rir@1');
  await page.locator('#applyPreset').click();
  // A real metadata control edit must affect actual candidate prescriptions.
  const control = page.locator('[data-policy-path="prescription.rirAdjustmentsBySetCount.2.0"]');
  await control.locator('xpath=ancestor::details[1]').locator('summary').click();
  await control.fill('-1');
  await control.dispatchEvent('change');
  assert.deepEqual(errors, [], 'resolved preset is detached into a mutable editor draft');
  await page.locator('#run').click();
  await page.locator('#runStatus').filter({ hasText: 'completed' }).waitFor({ timeout: 120000 });
  assert(workers.some(url => url.includes('program-engine.js')), 'real shared compiler worker was started');
  assert.match(await page.locator('#candidateProgram').textContent(), /RIR 0/);
  assert(!await page.locator('#candidateProgram .sets').getByText(/\bRIR 1\b/).count(), 'metadata edit changes the actual candidate prescriptions');
  await page.locator('#rawDetails summary').click();
  await page.waitForFunction(() => document.getElementById('rawResult').textContent.length > 0);
  const inspected = JSON.parse(await page.locator('#rawResult').textContent());
  assert.equal(inspected.configuration.candidatePolicy.prescription.rirAdjustmentsBySetCount[2][0], -1, 'run embeds the exact dirty candidate draft');
  const provenance = await page.evaluate(async runId => {
    const saved = await window.RepForgeProgramLabServices.loadRun(runId);
    const manifest = await (await fetch(new URL('programlab/build-manifest.json', document.baseURI))).json();
    return { actual: saved.run.buildProvenance, sourceCommit: manifest.sourceCommit, dirty: manifest.dirty,
      labFingerprint: manifest.labFingerprint, compilerHash: manifest.files['program-compiler.js'].sha256 };
  }, inspected.runId);
  assert(provenance.actual, 'saved run retains its immutable build provenance');
  assert.equal(provenance.actual.sourceCommit, provenance.sourceCommit);
  assert.equal(provenance.actual.dirty, provenance.dirty);
  assert.equal(provenance.actual.labFingerprint, provenance.labFingerprint);
  assert.equal(provenance.actual.sourceHashes['program-compiler.js'], provenance.compilerHash);
  await page.locator('#save').click();
  await page.locator('#persistenceStatus').filter({ hasText: 'Saved' }).waitFor();
  const actual = await page.locator('#candidateProgram').textContent();
  const savedId = await page.locator('#savedExperiments').inputValue();
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await download).saveAs(path.join(artifacts, 'experiment.json'));
  await page.locator('#importFiles').setInputFiles(path.join(artifacts, 'experiment.json'));
  await page.locator('#persistenceStatus').filter({ hasText: 'Imported' }).waitFor();
  assert.equal(await page.locator('#candidateProgram').textContent(), actual, 'real worker archive round-trip preserves inspected prescriptions');
  const savedCount = await page.locator('#savedExperiments option').count();
  const corrupted = JSON.parse(await readFile(path.join(artifacts, 'experiment.json'), 'utf8'));
  corrupted.transfer.manifest.records[0].hash = '0'.repeat(64);
  await page.locator('#importFiles').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(corrupted)) });
  await page.locator('#fatalError').filter({ hasText: /hash|manifest/i }).waitFor();
  assert.equal(await page.locator('#candidateProgram').textContent(), actual, 'invalid import preserves current output');
  await page.reload();
  await page.locator('html[data-lab-ready="true"]').waitFor();
  assert.equal(await page.locator('#savedExperiments option').count(), savedCount, 'corrupt archive committed no experiment');
  await page.locator('#savedExperiments').selectOption(savedId);
  await page.locator('#load').click();
  await page.locator('#candidateProgram').filter({ hasText: 'RIR 0' }).waitFor();
  assert.equal(await page.locator('#candidateProgram').textContent(), actual, 'saved result survives reload');
  await control.locator('xpath=ancestor::details[1]').locator('summary').click();
  await page.getByText('Advanced canonical request', { exact: true }).click();
  const requestJSON = await page.locator('#normalizedRequest').textContent();
  await page.locator('#canonicalRequest').fill('{');
  assert(await page.locator('#run').isDisabled(), 'unapplied canonical edits block execution');
  await page.locator('#applyCanonical').click();
  assert.equal(await page.locator('#canonicalRequest').getAttribute('aria-invalid'), 'true');
  await page.locator('#canonicalRequest').fill(requestJSON);
  await page.locator('#applyCanonical').click();
  assert.equal(await page.locator('#canonicalRequest').getAttribute('aria-invalid'), null);
  // Validation announces its field and blocks execution without discarding results.
  await control.fill('9');
  await control.dispatchEvent('change');
  assert(await page.locator('#run').isDisabled());
  assert.equal(await control.getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#validation').textContent(), /RIR|rir/);
  assert.equal(await page.locator('#candidateProgram').textContent(), actual);
  await page.screenshot({ path: path.join(artifacts, 'wide.png'), fullPage: true });
  for (const width of [720, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no page overflow at ${width}px / zoom-equivalent layout`);
    await page.locator('#experimentName').focus();
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.activeElement !== document.body), 'keyboard focus remains in controls');
    await page.screenshot({ path: path.join(artifacts, `width-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'real results remain usable with 200% enlarged text');
  assert(await page.locator('#policyControls input:visible').evaluateAll(controls => controls.every(control => control.getBoundingClientRect().width >= 44)), 'enlarged policy inputs retain an editable target');
  await page.screenshot({ path: path.join(artifacts, 'real-text-200.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('repforge'))), [], 'lab never writes production localStorage');
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'lab never registers production worker');
  assert.deepEqual(errors, []);
  await exerciseModes(page);
  await exerciseHistoricalArchives(page);
  assert.deepEqual(await production.evaluate(() => ({ program: localStorage.getItem('repforge_v1'), sentinel: localStorage.getItem('repforge_programlab_acceptance_sentinel') })), productionBefore, 'lab run/cancel/import/reload preserves the separate production origin program and sentinel');
  assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(database => database.name).sort()), ['taurifer_programlab_v1'], 'lab owns only its isolated database');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Program Lab: actual worker → edited prescriptions → save/reload/export/import; validation, keyboard and narrow layouts passed.');
  }
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) { console.error(await page.locator('#runStatus').textContent(), await page.locator('#fatalError').textContent()); await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); }
  throw error;
} finally { await browser?.close(); artifactPreview?.cleanup(); }
