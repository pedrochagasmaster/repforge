#!/usr/bin/env node
// PL-01: the baseline was captured on main before the policy extraction.
// Complete serialized results include failures, explanations and offers; this
// intentionally does not reduce equality to the successful ProgramDefinition.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { programLabDefaultCases } from './fixtures/programlab-default-cases.mjs';
const require = createRequire(import.meta.url);
const Compiler = require('../program-compiler.js');
const Adapter = require('../program-entry-adapter.js');
const Layout = require('../generation-layout.js');
const Catalog = require('../assets/exercise-catalog.json');
require('../generation-identity.js').prepareCatalog(Catalog);
const hash = text => createHash('sha256').update(text).digest('hex');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/programlab-integration-default-results.json', import.meta.url)));
const cases = programLabDefaultCases({ Adapter, Catalog, Layout });
assert.equal(Compiler.GENERATOR_VERSION, fixture.generatorVersion);
assert.equal(hash(readFileSync(new URL('../assets/exercise-catalog.json', import.meta.url))), fixture.catalogSha256);
assert.deepEqual(cases.map(item => item.key), fixture.cases.map(item => item.key),
  'baseline case population and order are preserved');
for (const [index, item] of cases.entries()) {
  const result = Compiler.generateProgram(item.request, Catalog);
  const json = JSON.stringify(result);
  const expected = fixture.cases[index];
  assert.equal(hash(json), expected.resultSha256, `${item.key}: complete omitted-policy result matches pre-extraction main`);
  assert.equal(Buffer.byteLength(json), expected.resultBytes, `${item.key}: serialized byte count`);
  assert.equal(result.ok, expected.ok);
}
console.log(`PL-01 omitted-policy parity: ${cases.length} complete results match ${fixture.sourceCommit}.`);
