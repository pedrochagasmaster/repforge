#!/usr/bin/env node
// Packaging checker fault injection. This proves byte identity and rejection,
// not generator behavior; the browser journey uses the real assembled engine.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildProgramLab } from '../tools/build-programlab.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'programlab-package-test-'));
try {
  const fixture = path.join(temporary, 'source');
  await mkdir(path.join(fixture, 'programlab'), { recursive: true });
  const html = await readFile(path.join(repo, 'programlab/index.html'), 'utf8');
  const sources = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(name => /\.(js|css)$/.test(name));
  for (const name of [...sources, 'programlab/archive-entry.js', 'programlab/archive.js', 'test/fixtures/program-compiler-corpus-cases.mjs', 'assets/exercise-catalog.json', 'fonts/plexsans.woff2', 'fonts/plexmono-400.woff2']) {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    try { await cp(path.join(repo, name), path.join(fixture, name)); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Repairable checker fixture, never executed as a generation engine.
      await writeFile(path.join(fixture, name), '/* packaging fixture only */\n');
    }
  }
  await writeFile(path.join(fixture, 'programlab/index.html'), html);
  const missing = path.join(fixture, 'programlab/services.js');
  const original = await readFile(missing);
  await rm(missing);
  const out = path.join(temporary, 'artifact');
  await assert.rejects(buildProgramLab({ sourceDir: fixture, outDir: out }), /Missing required.*services\.js/);
  await writeFile(missing, original);
  const manifest = await buildProgramLab({ sourceDir: fixture, outDir: out });
  assert.equal(manifest.generatorVersion, createRequire(import.meta.url)('../program-compiler.js').GENERATOR_VERSION);
  for (const [name, record] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(out, name));
    assert.equal(record.sha256, createHash('sha256').update(bytes).digest('hex'), `hash matches shipped bytes: ${name}`);
    assert.equal(record.bytes, bytes.length);
  }
  const rootHtml = await readFile(path.join(out, 'index.html'), 'utf8');
  assert(rootHtml.includes('<base href="./">'));
  assert(!rootHtml.includes('src="app.js"'), 'production app is absent');
  assert(!(await readdir(out)).includes('sw.js'), 'production worker is absent');
  assert.deepEqual(await readFile(path.join(out, 'assets/exercise-catalog.json')), await readFile(path.join(repo, 'assets/exercise-catalog.json')));
  assert(manifest.worker.scripts.includes('engine-policy.js'));
  assert(manifest.worker.scripts.includes('generation-layout.js'));
  await assert.rejects(buildProgramLab({ sourceDir: fixture, outDir: out }), /already exists/, 'never overwrites an existing artifact');
  await writeFile(path.join(fixture, 'programlab/index.html'), html.replace('src="exercises.js"', 'src="https://example.com/exercises.js"'));
  await assert.rejects(buildProgramLab({ sourceDir: fixture, outDir: path.join(temporary, 'unsafe') }), /local source paths/);
  console.log('Program Lab packaging: shipped-byte hashes, exact catalog, local worker inventory, missing-source/remote-source rejection, and no overwrite passed.');
} finally { await rm(temporary, { recursive: true, force: true }); }
