import {Adapter as NativeAdapter,Compiler as NativeCompiler,Draft as NativeDraft,Entry as NativeEntry,Identity as NativeIdentity,Metrics as NativeMetrics} from './fixtures/training-runtime.mjs';
/** Immutable migration oracle; never regenerate expectations from migrated code. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/architecture-baseline-v1.json', import.meta.url)));
const Compiler = NativeCompiler;
const Entry = NativeEntry;
const Adapter = NativeAdapter;
const Metrics = NativeMetrics;
const Catalog = require('../assets/exercise-catalog.json');
NativeIdentity.prepareCatalog(Catalog);
const Draft = NativeDraft;
const { inputs, expected } = fixture;
const before = JSON.stringify(inputs);
assert.deepEqual(Adapter.programRequestFromAnswers(inputs.answers, Catalog).value, inputs.request);
assert.deepEqual(Compiler.generateProgram(inputs.request, Catalog), expected.generation);
let draft = Draft.create(inputs.context, inputs.selection, {});
assert.equal(Draft.isDomainError(draft), false);
for (const command of inputs.commands) {
  draft = Draft.reduce(draft, command);
  assert.equal(Draft.isDomainError(draft), false, JSON.stringify(draft));
}
assert.deepEqual(draft, expected.draft);
const rows = Draft.toHistoryRows(draft, inputs.completedAt);
assert.deepEqual(rows, expected.historyRows);
assert.deepEqual(Entry.normalizeProfile(inputs.profile), expected.profile);
assert.deepEqual(Entry.normalizeProfile({ ...inputs.profile, futureAnswer: 'retain-me' }), expected.unknownProfile);
assert.deepEqual(Metrics.parseLoadInput('42,5', 'kg'), expected.loadComma);
assert.deepEqual(Metrics.parseLoadInput('1e2', 'kg'), expected.invalidLoad);
assert.equal(JSON.stringify(inputs), before, 'producer must not mutate frozen fixture inputs');

// Independent semantic oracles. A self-consistent but wrong recapture must fail.
function historyMeaning(values) {
  assert.equal(values.length, 1);
  const [row] = values;
  assert.equal(row.session, 'architecture-baseline-session');
  assert.equal(row.exerciseId, inputs.context.exercises[0].exerciseInstanceId);
  assert.equal(row.sourceLibraryId, '1a05c6f170d88058a3a0c07e098a9605');
  assert.equal(row.performedLibraryId, row.sourceLibraryId);
  assert.equal(row.metricType, 'source_metrics@1');
  assert.deepEqual(row.loadingContext, { loadingConvention: 'external', bodyweightKg: null, bodyweightContributionEnabled: false, externalLoadMultiplier: 1, bodyweightCoefficient: 0.076 });
  assert.deepEqual([row.load, row.reps, row.rir], [42.5, 8, 2]);
  assert.deepEqual(row.metricValues.map(value => [value.value, value.unit]), [[42.5, 'kg'], [8, 'reps']]);
  assert.equal(row.date, '2026-10-18');
  assert.equal(row.created, '2026-10-18T11:00:00.000Z');
}
historyMeaning(rows);
for (const mutate of [row => { row.session = 'wrong'; }, row => { row.exerciseId = row.sourceLibraryId; },
  row => { row.load = 43; }, row => { row.metricValues[0].unit = 'lb'; }, row => { delete row.loadingContext; }]) {
  const bad = structuredClone(expected.historyRows);
  mutate(bad[0]);
  assert.throws(() => historyMeaning(bad), 'deliberate identity/metric corruption must fail independent oracle');
}
assert.deepEqual(expected.generation.value.days.filter(day => day.kind === 'training').map(day => day.name), ['Workout A', 'Workout B']);
assert.equal(expected.profile.value.weightKg, 72.5);
assert.equal(expected.unknownProfile.ok, false, 'input validator refuses unknown keys; preservation is a storage responsibility');
assert.deepEqual(expected.loadComma, { kind: 'valid', kg: 42.5 });
assert.deepEqual(expected.invalidLoad, { kind: 'invalid' });
console.log('PASS immutable architecture baseline: complete generator, DraftV2/history identity, metric values, profile/parser, nonmutation and negative controls');

// Bounded pre-cutover complete-result corpus. Expectations were captured from
// source792fc25, never from the migrated implementation under test.
const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/architecture-corpus-v1.json', import.meta.url)));
assert.equal(corpus.source.captureHead, '792fc25ffbce131f347ff1084cbf130b2daf9e2a');
assert.deepEqual(corpus.generation.map(item => item.key), ['upper-lower-full-wave', 'upper-lower-full-linear',
  'limited-home-two-days', 'commercial-four-days', 'strength-deload', 'no-equipment-conflict', 'unsupported-wave-cycle-count']);
const successfulNames = {
  'upper-lower-full-wave': ['Upper', 'Lower', 'Full Body'],
  'upper-lower-full-linear': ['Upper', 'Lower', 'Full Body'],
  'limited-home-two-days': ['Workout A', 'Workout B'],
  'commercial-four-days': ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  'strength-deload': ['Upper', 'Lower', 'Full Body'],
};
for (const item of corpus.generation) {
  const inputBefore = JSON.stringify(item.request);
  if (item.answers) assert.deepEqual(Adapter.programRequestFromAnswers(item.answers, Catalog).value, item.request, item.key);
  const result = Compiler.generateProgram(item.request, Catalog);
  assert.deepEqual(result, item.expected, `${item.key}: complete source result parity`);
  assert.equal(JSON.stringify(item.request), inputBefore, `${item.key}: no request mutation`);
  if (successfulNames[item.key]) {
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.days.filter(day => day.kind === 'training').map(day => day.name), successfulNames[item.key]);
    assert.equal(Compiler.validateProgramDefinition(result.value, Catalog).ok, true, item.key);
  } else {
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.deepEqual(result.conflicts.map(conflict => conflict.code), [item.key === 'no-equipment-conflict' ? 'insufficient_candidates' : 'unsupported_generation_domain']);
  }
}
const wave = corpus.generation[0].expected.value;
assert.equal(wave.request.periodization, 'undulating');
assert.equal(wave.request.split, 'upper_lower_full');
assert.deepEqual(wave.request.deloadCycles, []);
assert.deepEqual(wave.days.find(day => day.kind === 'training').slots[0].prescriptionsByCycle.map(cycle => cycle.sets[0].targets.reps), [{ min: 7, max: 9 }, { min: 4, max: 6 }, { min: 2, max: 4 }, { min: 7, max: 9 }, { min: 4, max: 6 }, { min: 5, max: 7 }, { min: 2, max: 4 }], 'independent undulating first-primary source schedule');
assert.equal(corpus.generation[1].expected.value.request.periodization, 'linear');
assert.equal(corpus.generation[2].expected.value.request.split, 'full_body');
assert.equal(corpus.generation[3].expected.value.request.split, 'upper_lower_upper_lower');
const deload = corpus.generation[4].expected.value;
assert.deepEqual(deload.request.deloadCycles, [8]);
assert.equal(deload.days.find(day => day.kind === 'training').slots[0].prescriptionsByCycle[7].sets[0].provenance.deload, true);
assert.deepEqual(deload.days.find(day => day.kind === 'training').slots[0].prescriptionsByCycle[7].sets[0].targets.reps, { min: 3, max: 5 });
assert.deepEqual(deload.days.find(day => day.kind === 'training').slots[0].prescriptionsByCycle.map(cycle => cycle.cycleIndex), [1, 2, 3, 4, 5, 6, 7, 8]);
for (const item of corpus.drafts) {
  const inputBefore = JSON.stringify(item);
  let actual = Draft.create(item.context, item.selection, {});
  assert.equal(Draft.isDomainError(actual), false);
  for (const command of item.commands) {
    actual = Draft.reduce(actual, command);
    assert.equal(Draft.isDomainError(actual), false, item.key);
  }
  assert.deepEqual(actual, item.expected.draft, `${item.key}: complete finishing aggregate`);
  const actualRows = Draft.toHistoryRows(actual, item.completedAt);
  assert.deepEqual(actualRows, item.expected.rows, `${item.key}: complete history rows`);
  assert.equal(JSON.stringify(item), inputBefore, `${item.key}: no fixture mutation`);
  const [row] = actualRows;
  assert.equal(actualRows.length, 1);
  assert.equal(row.session, `architecture-${item.key}`);
  assert.equal(row.exerciseId, `slot-${item.key}`);
  assert.deepEqual([row.load, row.reps], [null, null], 'non-flat composition must not invent flat load/reps');
  if (item.key === 'per-side') {
    assert.equal(row.sourceLibraryId, '2a15c6f170d88066b38fd65f8757716f');
    assert.deepEqual(row.metricValues.map(value => [value.value, value.unit]), [[9, 'reps'], [12.5, 'kg']]);
    assert.deepEqual(row.metricDefinitions.map(definition => definition.semantic), ['repsPerSide', 'loadPerSideKg']);
    assert.equal(row.loadingContext.externalLoadMultiplier, 2);
    assert.equal(row.loadingConvention, 'per_side');
    assert.equal(row.rir, 2);
  } else {
    assert.equal(item.key, 'repless-duration');
    assert.equal(row.sourceLibraryId, '3015c6f170d88066b005e27ff4833597');
    assert.deepEqual(row.metricValues.map(value => [value.value, value.unit]), [[45, 'seconds']]);
    assert.deepEqual(row.metricDefinitions.map(definition => definition.semantic), ['durationSeconds']);
    assert.equal(row.rir, null, 'duration-only set has no invented effort target');
    assert.equal(row.loadingConvention, 'external');
  }
}
console.log('PASS bounded source corpus: five complete successes, two complete conflicts, per-side/repless finishing aggregates and history rows');
