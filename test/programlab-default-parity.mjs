#!/usr/bin/env node
// PL-01: the baseline was captured on main before the policy extraction.
// Complete serialized results include failures, explanations and offers; this
// intentionally does not reduce equality to the successful ProgramDefinition.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { programLabDefaultCases } from './fixtures/programlab-default-cases.mjs';
import {createGenerationRules} from '../src/training/generation.js';
import {createEntryAdapter} from '../src/training/authoring.js';
const {compiler:Compiler,identity}=createGenerationRules();
const Adapter=createEntryAdapter({compiler:Compiler});
const Catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url)));
identity.prepareCatalog(Catalog);
const Layout={SPLITS:Object.entries(Compiler.SPLITS).map(([id,split])=>({id,daysPerWeek:split.compatibleDays}))};
const Policy=Compiler;
const hash = text => createHash('sha256').update(text).digest('hex');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/programlab-integration-default-results.json', import.meta.url)));
const cases = programLabDefaultCases({ Adapter, Catalog, Layout });
const defaults = Policy.getDefaultEnginePolicy();
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
  assert.equal(JSON.stringify(Compiler.generateProgram(item.request, Catalog, { enginePolicy: defaults })),
    json, `${item.key}: explicit default preserves complete serialized result`);
  const { diagnostics, ...untraced } = Compiler.generateProgram(item.request, Catalog,
    { enginePolicy: defaults, diagnostics: 'allocation-lineage@1' });
  assert.equal(JSON.stringify(untraced), json, `${item.key}: diagnostics do not affect complete result`);
  assert.equal(diagnostics.version, 'allocation-lineage@1');
}
console.log(`PL-01/PL-09: ${cases.length} omitted/explicit-default complete results match ${fixture.sourceCommit}; diagnostics preserve every result.`);
