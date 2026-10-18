/** Immutable migration oracle; never regenerate expectations from migrated code. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/architecture-baseline-v1.json', import.meta.url)));
const Compiler = require('../program-compiler.js');
const Entry = require('../program-entry.js');
const Adapter = require('../program-entry-adapter.js');
const Metrics = require('../exercise-metrics.js');
const Catalog = require('../assets/exercise-catalog.json');
require('../generation-identity.js').prepareCatalog(Catalog);
globalThis.RepForgeExerciseCatalog = { snapshot: () => Catalog };
const Draft = require('../workout-draft.js');
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
  assert.deepEqual([row.load, row.reps, row.rir], [42.5, 8, 2]);
  assert.deepEqual(row.metricValues.map(value => [value.value, value.unit]), [[42.5, 'kg'], [8, 'reps']]);
  assert.equal(row.date, '2026-10-18');
  assert.equal(row.created, '2026-10-18T11:00:00.000Z');
}
historyMeaning(rows);
for (const mutate of [row => { row.session = 'wrong'; }, row => { row.exerciseId = row.sourceLibraryId; },
  row => { row.load = 43; }, row => { row.metricValues[0].unit = 'lb'; }, row => { delete row.loadingContext; row.sourceLibraryId = 'wrong'; }]) {
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
