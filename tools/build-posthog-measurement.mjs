#!/usr/bin/env node
/** Offline schema-1 insight compiler. No SDK changes, network calls, or credentials. */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => { throw new Error(message); };
const quote = value => `'${value.replaceAll("'", "''")}'`;
const list = values => values.map(quote).join(', ');
const member = ids => ids.length ? `distinct_id IN (${list(ids)})` : '1 = 0';
const notMember = ids => ids.length ? `distinct_id NOT IN (${list(ids)})` : '1 = 1';
const timestamp = value => `toDateTime(${quote(value.replace('T', ' ').replace('Z', ''))}, 'UTC')`;

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Expected a measurement configuration object.');
  const keys = ['projectId', 'timezone', 'from', 'asOf', 'appVersions', 'internalInstallationIds', 'pilotInstallationIds'];
  if (Object.keys(input).some(key => !keys.includes(key))) fail('Unknown configuration field.');
  if (!Number.isSafeInteger(input.projectId) || input.projectId < 1) fail('projectId must be a positive integer.');
  // The audited project uses UTC. Do not silently change calendar-day semantics.
  if (input.timezone !== 'UTC') fail('This recipe requires the verified UTC project timezone.');
  for (const key of ['from', 'asOf']) {
    const value = input[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z', 'Z') !== value) {
      fail(`${key} must be a valid UTC timestamp with second precision.`);
    }
  }
  if (Date.parse(input.asOf) > Date.now()) fail('asOf cannot be in the future.');
  if (input.from >= input.asOf) fail('from must precede asOf.');
  for (const key of ['appVersions', 'internalInstallationIds', 'pilotInstallationIds']) {
    const values = input[key];
    const pattern = key === 'appVersions' ? /^[A-Za-z0-9._-]{1,32}$/ : /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
    if (!Array.isArray(values) || values.length > 500 || values.some(value => typeof value !== 'string' || !pattern.test(value))) {
      fail(`${key} must be a bounded array of valid tokens.`);
    }
    if (new Set(values).size !== values.length) fail(`${key} contains duplicate entries.`);
  }
  if (!input.appVersions.length) fail('An explicit, nonempty appVersions range is required.');
  if (input.internalInstallationIds.some(id => input.pilotInstallationIds.includes(id))) fail('Internal and pilot rosters overlap.');
  return structuredClone(input);
}

/** The contract is the actual CommonJS export from telemetry.js, not a copied event list. */
export function buildPlan(input, contract) {
  const config = validateConfig(input);
  if (contract.getSchemaVersion() !== 1) fail('Review these recipes before using a new telemetry schema.');
  const names = contract.getEventNames();
  if (!names.length || names.some(name => !/^[a-z][a-z0-9_]*$/.test(name))) fail('Invalid product event taxonomy.');
  for (const event of ['app_boot', 'program_activated', 'first_set_logged', 'set_saved', 'session_completed', 'session_abandoned', 'one_off_completed']) {
    if (!names.includes(event)) fail('Required schema-1 event missing; review the recipes.');
  }
  const from = timestamp(config.from), end = timestamp(config.asOf);
  const window = `timestamp >= ${from} AND timestamp < ${end}`;
  const strict = `properties.telemetry_schema_version = 1 AND properties.release_channel = 'production' AND properties.app_version IN (${list(config.appVersions)})`;
  const internal = member(config.internalInstallationIds), pilot = member(config.pilotInstallationIds);
  const unknown = notMember([...config.internalInstallationIds, ...config.pilotInstallationIds]);
  const cohort = `multiIf(${internal}, 'internal', ${pilot}, 'confirmed_pilot', 'unclassified')`;
  const events = `event IN (${list(names)})`;
  const eligible = `${window} AND ${strict} AND (${pilot})`;
  const query = sql => ({ kind: 'DataVisualizationNode', source: { kind: 'HogQLQuery', query: sql }, display: 'ActionsTable' });
  const insights = [];
  const add = (key, title, description, sql) => insights.push({
    key, payload: { name: `Taurifer s1 — ${title}`, description, saved: true,
      tags: ['taurifer-measurement-s1', key], query: query(sql) }
  });
  // Health checks deliberately see bad/missing labels and preview/internal events.
  // Filtering them with the scorecard predicate would hide the defects being audited.
  add('contract-health', 'Collection contract health', 'Events; all traffic in the observation window, including invalid releases. Review unknown events separately from schema-1 scorecards.',
    `SELECT event, count() AS events, countIf(coalesce(toString(properties.telemetry_schema_version), '') != '1') AS wrong_or_missing_schema,
countIf(coalesce(toString(properties.app_version), '') = '') AS missing_version,
countIf(coalesce(toString(properties.release_channel), '') = '') AS missing_channel,
countIf(event IN ('set_saved', 'session_completed', 'session_abandoned', 'one_off_completed') AND coalesce(toString(properties.$session_id), '') = '') AS missing_session
FROM events WHERE ${window} AND (${events} OR event NOT LIKE '$%') GROUP BY event ORDER BY events DESC LIMIT 500`);
  add('release-inventory', 'Release and channel inventory', 'Events; unfiltered label inventory. Missing labels, preview traffic and new versions must remain visible. No host or bot predicate.',
    `SELECT properties.telemetry_schema_version AS schema, properties.app_version AS app_version, properties.release_channel AS channel, count() AS events
FROM events WHERE ${window} AND ${events} GROUP BY schema, app_version, channel ORDER BY events DESC LIMIT 500`);
  add('cohort-coverage', 'Attribution coverage', 'Events and distinct installations, not people. Only confirmed rosters define internal/pilot; every other installation is unclassified, not organic.',
    `SELECT ${cohort} AS attribution, event, count() AS events, count(DISTINCT distinct_id) AS installations
FROM events WHERE ${window} AND ${strict} AND ${events} GROUP BY attribution, event ORDER BY attribution, event LIMIT 500`);
  insights.push({ key: 'boots', payload: {
    name: 'Taurifer s1 — Daily boots by attribution', saved: true, tags: ['taurifer-measurement-s1', 'boots'],
    description: 'Distinct installations per UTC day; counts across browsers/devices are not people. Internal and unclassified series are diagnostics, not pilot validation.',
    query: { kind: 'InsightVizNode', source: {
      kind: 'TrendsQuery', dateRange: { date_from: config.from, date_to: config.asOf }, interval: 'day', filterTestAccounts: false,
      properties: [{ type: 'hogql', key: `${window} AND ${strict}` }],
      series: [['internal', internal], ['confirmed_pilot', pilot], ['unclassified', unknown]].map(([name, predicate]) => ({
        kind: 'EventsNode', event: 'app_boot', name, math: 'hogql', math_hogql: 'count(DISTINCT distinct_id)',
        properties: [{ type: 'hogql', key: predicate }]
      }))
    } }
  } });
  add('pilot-milestones', 'Confirmed pilot milestones', 'Independent event reach, NOT a conversion funnel. Empty pilot roster deliberately returns no data; do not substitute all non-internal traffic.',
    `SELECT event, count() AS events, count(DISTINCT distinct_id) AS installations
FROM events WHERE ${eligible} AND ${events} GROUP BY event ORDER BY event LIMIT 500`);
  add('session-outcomes', 'Saved-set session outcomes', 'Unit: installation + SDK session. Planned and one-off saved-set sessions, not the one-time milestone. Reloads may split SDK sessions; unresolved does not mean abandoned.',
    `SELECT count() AS saved_set_sessions,
countIf(completions = 1 AND abandonments = 0) AS completed,
countIf(abandonments = 1 AND completions = 0) AS explicitly_abandoned,
countIf(completions = 0 AND abandonments = 0) AS unresolved,
countIf(completions > 1 OR abandonments > 1 OR (completions > 0 AND abandonments > 0)) AS duplicate_or_conflicting
FROM (
SELECT first_save, arrayCount(t -> t >= first_save, completion_times) AS completions,
arrayCount(t -> t >= first_save, abandonment_times) AS abandonments
FROM (
SELECT distinct_id, properties.$session_id AS sdk_session, minIf(timestamp, event = 'set_saved') AS first_save,
groupArrayIf(timestamp, event IN ('session_completed', 'one_off_completed')) AS completion_times,
groupArrayIf(timestamp, event = 'session_abandoned') AS abandonment_times
FROM events WHERE ${eligible} AND event IN ('set_saved', 'session_completed', 'session_abandoned', 'one_off_completed')
AND coalesce(toString(properties.$session_id), '') != ''
GROUP BY distinct_id, sdk_session HAVING countIf(event = 'set_saved') > 0
))`);
  // A witnessed first-run boot avoids silently treating a returning installation's
  // next activation as a new-installation milestone. This is a restricted cohort.
  const firstValue = `SELECT minIf(timestamp, event = 'program_activated') AS activated,
minIf(timestamp, event = 'first_set_logged') AS first_set,
groupArrayIf(timestamp, event = 'session_completed') AS completed,
countIf(event = 'first_set_logged') AS first_sets
FROM events WHERE ${eligible} AND event IN ('app_boot', 'program_activated', 'first_set_logged', 'session_completed')
GROUP BY distinct_id HAVING countIf(event = 'app_boot' AND properties.first_run = true) > 0 AND countIf(event = 'program_activated') > 0`;
  add('first-value', 'First-run-observed first value — 14 days', 'Confirmed pilots with a witnessed first-run boot and activation. Mature numerator/denominator only; pending installations are separate. First observed activation in this explicit window, not reactivation.',
    `SELECT count() AS activated_new_installations, countIf(mature) AS eligible_14d,
countIf(mature AND converted) AS completed_14d, countIf(NOT mature) AS pending_14d,
countIf(NOT mature AND converted) AS pending_already_completed,
countIf(mature AND converted) / nullIf(countIf(mature), 0) AS completion_rate
FROM (SELECT activated + INTERVAL 14 DAY <= ${end} AS mature,
first_sets > 0 AND first_set >= activated AND arrayExists(t -> t >= first_set AND t <= activated + INTERVAL 14 DAY, completed) AS converted
FROM (${firstValue}))`);
  for (const days of [7, 30, 60]) {
    add(`repeat-${days}`, `First-run-observed repeat training — ${days} days`, `Confirmed pilots with witnessed first-run boots; a later UTC date AND different SDK session must complete within ${days} elapsed days. Only mature cohorts enter the rate. Not exact-day retention.`,
      `SELECT countIf(mature) AS eligible, countIf(mature AND returned) AS returning,
countIf(NOT mature) AS pending, countIf(mature AND returned) / nullIf(countIf(mature), 0) AS repeat_rate
FROM (SELECT first_completion + INTERVAL ${days} DAY <= ${end} AS mature,
arrayExists(x -> toDate(x.1) > toDate(first_completion) AND x.1 <= first_completion + INTERVAL ${days} DAY AND x.2 != first_session, completions) AS returned
FROM (SELECT minIf(timestamp, event = 'session_completed') AS first_completion,
argMinIf(toString(properties.$session_id), timestamp, event = 'session_completed') AS first_session,
groupArrayIf(tuple(timestamp, toString(properties.$session_id)), event = 'session_completed') AS completions
FROM events WHERE ${eligible} AND (event = 'app_boot' OR (event = 'session_completed' AND coalesce(toString(properties.$session_id), '') != ''))
GROUP BY distinct_id HAVING countIf(event = 'app_boot' AND properties.first_run = true) > 0 AND countIf(event = 'session_completed') > 0))`);
  }
  return { recipeVersion: 1, projectId: config.projectId, timezone: config.timezone,
    from: config.from, asOf: config.asOf, appVersions: config.appVersions,
    rosterCounts: { internal: config.internalInstallationIds.length, confirmedPilot: config.pilotInstallationIds.length },
    warnings: ['PRIVATE: compiled queries contain installation IDs. Never commit or publicly share this file.',
      'No host, user-agent/bot, person-property or empty project test-cohort filters are inherited.',
      'Fixed observation window; regenerate for each reading. Dashboard date overrides do not change these SQL windows.',
      'First-value/repeat rates require a witnessed first_run boot; this is not proof of first-ever use. Confirm recruitment/history privately.'],
    eventPolicies: Object.fromEntries(names.map(name => [name, contract.getEventPolicy(name)])),
    dashboard: { name: 'Taurifer — schema 1 measurement', description: 'Versioned alpha recipes. See repository measurement docs; cohorts are installations, not people.', tags: ['taurifer-measurement-s1'] },
    insights };
}

function outsideRepository(path) {
  const rel = relative(realpathSync(ROOT), path);
  if (rel === '' || (!rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(rel))) {
    fail('Keep measurement configuration and output outside the repository.');
  }
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 2) fail('Usage: node tools/build-posthog-measurement.mjs /private/config.json /private/plan.json');
  const input = realpathSync(resolve(args[0]));
  const output = resolve(realpathSync(dirname(resolve(args[1]))), resolve(args[1]).split(/[\\/]/).pop());
  outsideRepository(input); outsideRepository(output);
  let config;
  try { config = JSON.parse(readFileSync(input, 'utf8')); } catch { fail('Cannot parse the private measurement configuration.'); }
  const contract = createRequire(import.meta.url)('../telemetry.js');
  const plan = buildPlan(config, contract);
  // Exclusive creation refuses overwrites and symlinks; 0600 protects identities.
  writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`Generated ${plan.insights.length} insight definitions; no PostHog changes made.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    // Filesystem/JSON parser diagnostics can echo private paths or contents.
    console.error(error.code ? 'Measurement build failed; check private file access and use a new output filename.' : error.message);
    process.exitCode = 1;
  }
}
