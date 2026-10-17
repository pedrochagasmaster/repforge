#!/usr/bin/env node
/** Assemble an isolated local Program Lab from this checkout. No deployment. */
import { readFile, writeFile, mkdir, readdir, lstat, mkdtemp, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const workerSources = ['exercise-metrics.js', 'generation-identity.js', 'engine-policy.js', 'generation-candidates.js', 'generation-layout.js', 'program-compiler.js', 'exercise-catalog.js'];
const required = ['programlab/index.html', 'programlab/styles.css', 'programlab/app.js', 'programlab/domain.js', 'programlab/store.js', 'programlab/services.js', 'assets/exercise-catalog.json', 'fonts/plexsans.woff2', 'fonts/plexmono-400.woff2', 'exercises.js', 'program-entry-adapter.js', 'program-engine.js', ...workerSources];
function git(sourceDir, args) {
  try { return execFileSync('git', ['-C', sourceDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
function localPath(name) {
  if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(part => ['..', '.', ''].includes(part)) || /[:?#]/.test(name)) throw new Error(`Artifact references must be local source paths: ${name}`);
  return name;
}
async function staticFiles(sourceDir, folder) {
  const files = [];
  for (const entry of await readdir(path.join(sourceDir, folder), { withFileTypes: true })) {
    const name = `${folder}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlink sources are not supported: ${name}`);
    if (entry.isDirectory()) files.push(...await staticFiles(sourceDir, name));
    else if (/\.(?:js|mjs|css|html|json)$/.test(name) && !name.endsWith('/build-manifest.json')) files.push(name);
  }
  return files;
}
export async function buildProgramLab({ sourceDir = repository, outDir } = {}) {
  const source = path.resolve(sourceDir);
  const output = path.resolve(outDir || path.join(source, 'dist/programlab'));
  if (output === source || source.startsWith(`${output}${path.sep}`)) throw new Error('Output must not contain the source checkout');
  if (existsSync(output)) throw new Error(`Output already exists; choose a new artifact directory: ${output}`);
  for (const name of new Set(required)) {
    if (!existsSync(path.join(source, name))) throw new Error(`Missing required Program Lab source: ${name}`);
    if (!(await lstat(path.join(source, name))).isFile()) throw new Error(`Source must be a regular file: ${name}`);
  }
  const html = await readFile(path.join(source, 'programlab/index.html'), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(name => !['../', './'].includes(name));
  references.forEach(localPath);
  const names = [...new Set([...required, ...references, ...await staticFiles(source, 'programlab')])].sort();
  const content = new Map();
  for (const name of names) {
    localPath(name);
    if (!(await lstat(path.join(source, name))).isFile()) throw new Error(`Source must be a regular file: ${name}`);
    content.set(name, await readFile(path.join(source, name)));
  }
  const catalogSha256 = sha256(content.get('assets/exercise-catalog.json'));
  const pin = content.get('exercises.js').toString().match(/(?:EXERCISE_CATALOG_SHA256|catalogSha256)\s*(?:=|:)\s*["']([a-f0-9]{64})["']/)?.[1];
  if (pin !== catalogSha256) throw new Error('Catalog bytes do not match the generated catalog integrity pin');
  const generatorVersion = content.get('program-compiler.js').toString().match(/const GENERATOR_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  if (!generatorVersion) throw new Error('Compiler generator identity is unavailable');
  content.set('index.html', Buffer.from(html.replace('<base href="../">', '<base href="./">')));
  const sourceCommit = git(source, ['rev-parse', 'HEAD']);
  const dirtyStatus = git(source, ['status', '--porcelain']);
  const files = Object.fromEntries([...content].map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length, source: name === 'index.html' ? 'programlab/index.html (root entry)' : name }]));
  const fingerprint = list => sha256(Buffer.from(JSON.stringify(list.map(name => [name, files[name].sha256]))));
  const runtimeFiles = [...new Set([...workerSources, 'exercises.js', 'program-entry-adapter.js', 'program-engine.js'])].sort();
  const labFiles = names.filter(name => name.startsWith('programlab/') && /\.(?:js|mjs)$/.test(name));
  const manifest = {
    kind: 'taurifer-programlab-build', schemaVersion: 1, sourceCommit,
    dirty: sourceCommit ? dirtyStatus !== '' : null,
    generatorVersion, programSchemaVersion: 2, policyVersion: 'engine-policy@1', diagnosticsVersion: 'lineage-timefit@1',
    catalogSha256, runtimeFingerprint: fingerprint(runtimeFiles), labFingerprint: fingerprint(labFiles),
    worker: { url: 'program-engine.js', scripts: workerSources, catalogSha256 }, files,
  };
  await mkdir(path.dirname(output), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(output), '.programlab-build-'));
  try {
    for (const [name, bytes] of content) {
      await mkdir(path.dirname(path.join(staging, name)), { recursive: true });
      await writeFile(path.join(staging, name), bytes);
    }
    await writeFile(path.join(staging, 'programlab/build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(staging, 'README.txt'), 'Taurifer Program Lab — local standalone artifact\n\nServe only on loopback:\n  python3 -m http.server 8000 --bind 127.0.0.1 --directory <this-directory>\nOpen http://127.0.0.1:8000/ in a fresh browser profile.\nNo service worker, production navigation, or deployment is included.\nDo not expose this artifact on a public server. Hosted owner access must be configured separately before exposure.\nBuild provenance: programlab/build-manifest.json. Hashes detect changes; they do not establish authorship.\n');
    // rename is the only publication point; existing output is never deleted.
    if (existsSync(output)) throw new Error(`Output already exists: ${output}`);
    await rename(staging, output);
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args[0] !== '--out' || args.length !== 2)) {
    console.error('Usage: node tools/build-programlab.mjs [--out <new-directory>]'); process.exitCode = 1;
  } else {
    try {
      const outDir = path.resolve(args[1] || path.join(repository, 'dist/programlab'));
      const manifest = await buildProgramLab({ outDir });
      console.log(`Program Lab assembled at ${outDir}\nGenerator ${manifest.generatorVersion}; runtime ${manifest.runtimeFingerprint}; catalog ${manifest.catalogSha256}`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
