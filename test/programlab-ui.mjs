#!/usr/bin/env node
// Production-backed Program Lab journey. Requires the packaged shared modules;
// this suite must never substitute a mock engine or persistence layer.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { launchChromium } from './browser.mjs';
const base = process.env.REPFORGE_URL || 'http://localhost:8000/';
const lab = new URL('programlab/', base).href;
const artifacts = process.env.REPFORGE_ARTIFACT_DIR || path.resolve('.ci-results/programlab-ui');
await mkdir(artifacts, { recursive: true });
const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const workers = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
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
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('repforge'))), [], 'language preference never touches production keys');
    await page.locator('#language').selectOption('en');
    await page.locator('html[lang="en"]').waitFor();
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    assert.deepEqual(errors, []);
    console.log('Program Lab shell: missing integration blocks run; labels, same-page keyboard skip, 1440/720/390 layouts, 200% enlarged text, English/Portuguese draft preservation and storage isolation passed. Full worker journey remains pending.');
    await context.close();
  } else {
  await page.locator('html[data-lab-ready="true"]').waitFor({ timeout: 20000 });
  assert.match(await page.locator('#buildIdentity').textContent(), /073\.4|Generator/);
  await page.locator('#experimentName').fill('Browser proof: two sets');
  await page.locator('#fixture').selectOption('anchor-4day');
  await page.locator('#preset').selectOption('two_sets_low_rir@1');
  await page.locator('#applyPreset').click();
  // A real metadata control edit must affect actual candidate prescriptions.
  const control = page.locator('[data-policy-path="prescription.rirPerRemainingSet"]');
  await control.fill('0');
  await control.dispatchEvent('change');
  await page.locator('#run').click();
  await page.locator('#runStatus').filter({ hasText: 'completed' }).waitFor({ timeout: 120000 });
  assert(workers.some(url => url.includes('program-engine.js')), 'real shared compiler worker was started');
  assert.match(await page.locator('#candidateProgram').textContent(), /RIR 0/);
  assert(!await page.locator('#candidateProgram').getByText('RIR 1', { exact: false }).count(), 'zero-step candidate actually changes RIR');
  await page.locator('#save').click();
  await page.locator('#persistenceStatus').filter({ hasText: 'Saved' }).waitFor();
  const actual = await page.locator('#candidateProgram').textContent();
  await page.reload();
  await page.locator('html[data-lab-ready="true"]').waitFor();
  await page.locator('#savedExperiments').selectOption({ label: 'Browser proof: two sets' });
  await page.locator('#load').click();
  await page.locator('#candidateProgram').filter({ hasText: 'RIR 0' }).waitFor();
  assert.equal(await page.locator('#candidateProgram').textContent(), actual, 'saved result survives reload');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await download).saveAs(path.join(artifacts, 'experiment.json'));
  await page.locator('#importFiles').setInputFiles(path.join(artifacts, 'experiment.json'));
  await page.locator('#persistenceStatus').filter({ hasText: 'Imported' }).waitFor();
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
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('repforge'))), [], 'lab never writes production localStorage');
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'lab never registers production worker');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Program Lab: actual worker → edited prescriptions → save/reload/export/import; validation, keyboard and narrow layouts passed.');
  }
} finally { await browser.close(); }
