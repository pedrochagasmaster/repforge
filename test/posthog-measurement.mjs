import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildPlan, validateConfig } from '../tools/build-posthog-measurement.mjs';

const internal = '00000000-0000-4000-8000-000000000001';
const pilot = '00000000-0000-4000-8000-000000000002';
const config = () => ({ projectId: 1, timezone: 'UTC', from: '2020-01-01T00:00:00Z', asOf: '2020-04-01T00:00:00Z',
  appVersions: ['release-a'], internalInstallationIds: [internal], pilotInstallationIds: [pilot] });
const names = ['app_boot', 'program_activated', 'first_set_logged', 'set_saved', 'session_completed', 'session_abandoned', 'one_off_completed'];
const contract = { getSchemaVersion: () => 1, getEventNames: () => names,
  getEventPolicy: name => name === 'first_set_logged' ? 'milestone' : 'repeatable' };
const sql = (plan, key) => plan.insights.find(insight => insight.key === key).payload.query.source.query;

for (const [name, mutate] of [
  ['missing versions', c => { c.appVersions = []; }],
  ['invalid version', c => { c.appVersions = ["v1') OR 1=1 --"]; }],
  ['invalid identity', c => { c.pilotInstallationIds = ["x') OR 1=1 --"]; }],
  ['roster overlap', c => { c.pilotInstallationIds = [internal]; }],
  ['duplicate roster', c => { c.internalInstallationIds = [internal, internal]; }],
  ['invalid project', c => { c.projectId = '1'; }],
  ['unknown key', c => { c.apiKey = 'never-accepted'; }],
  ['non UTC timezone', c => { c.timezone = 'America/Sao_Paulo'; }],
  ['impossible date', c => { c.from = '2020-02-31T00:00:00Z'; }],
  ['reversed dates', c => { c.from = c.asOf; }],
  ['future as-of', c => { c.asOf = '2999-01-01T00:00:00Z'; }],
  ['offset date', c => { c.asOf = '2020-04-01T00:00:00-03:00'; }],
  ['non array roster', c => { c.pilotInstallationIds = null; }]
]) test(`rejects ${name}`, () => { const c = config(); mutate(c); assert.throws(() => buildPlan(c, contract)); });

test('validation returns a copy and never changes the caller roster', () => {
  const c = config(); validateConfig(c).appVersions.push('other'); assert.deepEqual(c.appVersions, ['release-a']);
});
test('schema upgrades fail closed rather than quietly reusing schema-1 queries', () => {
  assert.throws(() => buildPlan(config(), { ...contract, getSchemaVersion: () => 2 }));
  assert.throws(() => buildPlan(config(), { ...contract, getEventNames: () => ['app_boot'] }));
});
test('event inventory and policies come from the provided contract, not a hardcoded count', () => {
  const plan = buildPlan(config(), { ...contract, getEventNames: () => [...names, 'future_valid_event'] });
  assert.match(sql(plan, 'cohort-coverage'), /future_valid_event/);
  assert.equal(plan.eventPolicies.first_set_logged, 'milestone');
  assert.equal(plan.insights.length, 10);
  assert.equal(new Set(plan.insights.map(i => i.key)).size, plan.insights.length);
});
test('no legacy host, bot, user agent, person property, or automatic test filter', () => {
  const plan = buildPlan(config(), contract), text = JSON.stringify(plan.insights);
  assert.doesNotMatch(text, /\$host|\$browser|\$user_agent|\$is_bot|person\.properties|internal_or_test_user|\$pageview|workout_started/);
  assert.ok(plan.insights.every(i => i.payload.description.length <= 400));
  const boots = plan.insights.find(i => i.key === 'boots').payload.query.source;
  assert.equal(boots.filterTestAccounts, false);
  assert.ok(boots.series.every(s => s.math_hogql === 'count(DISTINCT distinct_id)'));
});
test('scorecard filters bind schema, production, versions, explicit pilot cohort and half-open UTC window', () => {
  const query = sql(buildPlan(config(), contract), 'pilot-milestones');
  for (const expected of ['telemetry_schema_version = 1', "release_channel = 'production'", "app_version IN ('release-a')", pilot, 'timestamp >=', 'timestamp <']) assert.ok(query.includes(expected));
  assert.ok(!query.includes(internal));
});
test('health checks do not hide wrong schemas, missing labels, preview, or unknown events', () => {
  const plan = buildPlan(config(), contract);
  for (const key of ['contract-health', 'release-inventory']) {
    const where = sql(plan, key).split('FROM events WHERE')[1];
    assert.doesNotMatch(where, /release_channel = 'production'|telemetry_schema_version = 1|app_version IN/);
    assert.doesNotMatch(where, new RegExp(pilot));
  }
  assert.match(sql(plan, 'contract-health'), /event NOT LIKE '\$%'/);
  assert.match(sql(plan, 'contract-health'), /missing_session/);
});
test('empty rosters remain empty; unclassified never becomes a confirmed pilot', () => {
  const plan = buildPlan({ ...config(), internalInstallationIds: [], pilotInstallationIds: [] }, contract);
  assert.match(sql(plan, 'pilot-milestones'), /AND \(1 = 0\)/);
  const series = plan.insights.find(i => i.key === 'boots').payload.query.source.series;
  assert.deepEqual(series.map(s => s.properties[0].key), ['1 = 0', '1 = 0', '1 = 1']);
  assert.match(sql(plan, 'cohort-coverage'), /unclassified/);
  assert.doesNotMatch(sql(plan, 'cohort-coverage'), /organic/);
});
test('session reliability uses all saved-set sessions and distinguishes unresolved/conflicting terminals', () => {
  const query = sql(buildPlan(config(), contract), 'session-outcomes');
  assert.doesNotMatch(query, /first_set_logged/);
  for (const expected of ["event IN ('session_completed', 'one_off_completed')", 'GROUP BY distinct_id, sdk_session', "HAVING countIf(event = 'set_saved') > 0", 't >= first_save', 'unresolved', 'duplicate_or_conflicting']) assert.ok(query.includes(expected));
});
test('first-value and repeat denominators require maturity, witnessed new installs, and null-safe rates', () => {
  const plan = buildPlan(config(), contract);
  for (const key of ['first-value', 'repeat-7', 'repeat-30', 'repeat-60']) {
    const query = sql(plan, key);
    assert.match(query, /properties\.first_run = true/);
    assert.match(query, /countIf\(NOT mature\)/);
    assert.match(query, /nullIf\(countIf\(mature\), 0\)/);
  }
  assert.match(sql(plan, 'first-value'), /first_set >= activated/);
  assert.match(sql(plan, 'first-value'), /t >= first_set AND t <= activated \+ INTERVAL 14 DAY/);
  assert.match(sql(plan, 'repeat-7'), /toDate\(x\.1\) > toDate\(first_completion\)/);
  assert.match(sql(plan, 'repeat-7'), /x\.2 != first_session/);
});
test('every event scan has an explicit bounded time window; no raw identity output', () => {
  for (const insight of buildPlan(config(), contract).insights) {
    const query = insight.payload.query.source.query;
    if (!query) continue;
    for (const tail of query.split('FROM events WHERE').slice(1)) {
      assert.match(tail, /^ timestamp >= .* AND timestamp </);
    }
    assert.doesNotMatch(query, /SELECT distinct_id[^]*FROM events[^]*LIMIT/);
    assert.ok(!query.endsWith(';'));
  }
});

test('CLI is offline, external-path-only, redacts parse errors, and writes private files exclusively', () => {
  const temp = mkdtempSync(join(tmpdir(), 'taurifer-measurement-'));
  try {
    const root = join(temp, 'repo'); mkdirSync(join(root, 'tools'), { recursive: true });
    const tool = join(root, 'tools', 'build-posthog-measurement.mjs');
    copyFileSync(new URL('../tools/build-posthog-measurement.mjs', import.meta.url), tool);
    writeFileSync(join(root, 'telemetry.js'), `module.exports = {getSchemaVersion:()=>1,getEventNames:()=>${JSON.stringify(names)},getEventPolicy:()=>"repeatable"};`);
    const input = join(temp, 'config.json'), output = join(temp, 'plan.json');
    writeFileSync(input, JSON.stringify(config()));
    const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });
    let result = run(input, output); assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.equal(JSON.parse(readFileSync(output)).insights.length, 10);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(`${internal}|${pilot}`));
    result = run(input, output); assert.equal(result.status, 1); assert.doesNotMatch(result.stderr, new RegExp(temp));
    result = run(input, join(root, 'private.json')); assert.equal(result.status, 1);
    const inside = join(root, 'config.json'); copyFileSync(input, inside);
    result = run(inside, join(temp, 'blocked.json')); assert.equal(result.status, 1);
    const link = join(temp, 'linked-output.json'); symlinkSync(join(root, 'leaked.json'), link);
    result = run(input, link); assert.equal(result.status, 1); assert.ok(!existsSync(join(root, 'leaked.json')));
    writeFileSync(input, '{"secret":"NEVER_PRINT_THIS"');
    result = run(input, join(temp, 'bad.json')); assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /NEVER_PRINT_THIS/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

// In a full checkout also verify the production contract. No browser or SDK needed.
const productionModule = new URL('../telemetry.js', import.meta.url);
test('production telemetry taxonomy compiles', { skip: !process.env.CI && !existsSync(productionModule) }, () => {
  const actual = createRequire(import.meta.url)('../telemetry.js');
  const plan = buildPlan(config(), actual);
  assert.deepEqual(Object.keys(plan.eventPolicies), [...actual.getEventNames()]);
});
