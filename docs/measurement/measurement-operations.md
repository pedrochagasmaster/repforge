# Measurement operations and privacy runbook

This runbook gates production telemetry for schema `1`. It complements the
[`alpha scorecard`](alpha-scorecard.md) and
[`dashboard recipes`](posthog-dashboard-recipes.md).

## Required PostHog project state

Verify after project creation and after any PostHog configuration change:

- person profiles disabled; no identify, alias, group, or `$set` path;
- web analytics, pageview/pageleave, surveys, flags, heatmaps, dead/rage click,
  exception, console-log, performance, and network-body capture disabled;
- replay sampling set to 100% of eligible opted-in sessions;
- replay text and input masking enabled with no unmask selector;
- request/response headers and bodies, canvas, and cross-origin frames disabled;
- the public ingestion proxy host matches the generated deploy config;
- preview collection disabled unless an explicit preview verification window is
  open; and
- retention/access controls follow the project's approved operational policy.

Application configuration remains authoritative even if a project toggle
drifts. Project state is still a release gate because remote settings can
change SDK behavior.

## Zero-tolerance health queries

| Invariant | Threshold | Immediate response | Owner |
|---|---:|---|---|
| Unknown custom event or wrong schema | 1 event | Stop analysis and alpha recruitment; identify producing app version | Founder |
| Forbidden key, value, URL query/fragment, setup prefix, or hostile sentinel | 1 event | Privacy incident: disable the affected automatic path, preserve evidence, fix and regression-test before re-enable | Founder |
| Person profile, identify/alias, group, or `$set` event | 1 event | Disable ingestion path and correct identity/project configuration | Founder |
| Client ingestion/rate-limit warning | 1 warning | Find loops/duplicates before interpreting counts | Founder |
| Product event missing schema/app/channel | 1 event | Exclude producing release and repair adapter | Founder |
| Preview/test traffic included in a production scorecard | 1 included event | Repair filters and invalidate the mixed reading | Founder |
| Autocapture action missing or outside the five-token set | 1 event | Disable autocapture and investigate the producing release | Founder |

Subscribe to a threshold alert where PostHog supports the exact query.
Otherwise add the invariant to the daily alpha checklist. An alert is not
complete until the owner and response are recorded.

## Silence and replay checks

Silence becomes actionable only after at least three opted-in installations
produced `app_boot` in the prior seven days:

- 48 hours with no production boot: verify deployment, proxy, blockers, and
  tester eligibility;
- 72 hours with boots but no other product event: verify boundary rejection,
  SDK loading, and call-site releases;
- after 20 eligible opted-in sessions, replay availability below 80%: separate
  opt-out, browser blocking, SDK failure, and ingestion failure before acting.

These are pipeline checks, never product-success thresholds.

## Production deploy smoke

Run within 30 minutes of each production deploy:

1. Record commit SHA, generated `app_version`, production URL, tester/browser,
   start time, and project timezone.
2. On a clean install, confirm exactly one `app_boot` with safe origin/path and
   no query, fragment, person profile, or extra property.
3. Choose a program route explicitly and activate it; verify the expected
   closed events and duplicate expectations.
4. Log and finish a synthetic session; verify only bucketed counts/duration.
5. Open one marked navigation action; verify the reconstructed
   `$autocapture.telemetry_action` and absence of text/DOM/URL fields.
6. Inspect replay: useful geometry/interactions, all app text and inputs masked,
   blocked sensitive regions absent, no request/response bodies or console.
7. Opt out during the recording; verify recording stops, pending queues clear,
   no later request is sent, and a workout still saves.
8. Reload while opted out; verify the switch remains off and the SDK does not
   resume collection. Opt in and verify only future events resume with the same
   installation identity.
9. Repeat a returning-install boot and an offline product flow. Telemetry
   failure must not change product results.
10. Remove/exclude synthetic smoke traffic using its preview/release context;
    never weaken production filters to find it.

## Hostile leakage smoke

Before release, place distinct sentinels in URL query/fragment, setup payload,
exercise name, workout values, notes, recommendation text, import/program text,
and a thrown error. Intercept ingestion, replay, survey, flags, static SDK, and
extension requests. Search raw and URL-encoded bodies/headers. Any match fails
the release and triggers the privacy response above.

## Incident record

For every health or privacy incident record:

- detection time and query;
- affected release/channel and earliest/latest event;
- exact invariant, never the leaked user value in ordinary issue text;
- ingestion/automatic path disabled and time disabled;
- containment and deletion/escalation decision;
- root cause and regression test;
- verified fixed commit/deploy; and
- re-enable approval.

Do not paste setup payloads, workout data, notes, full URLs, or replay contents
into GitHub, logs, or the PR body.

## Release evidence template

```text
Commit / app_version:
Deployment:
Project timezone:
Smoke start/end:
Clean + returning + offline:
Product events and duplicate audit:
Autocapture allowlist:
Replay masking:
Opt-out before/after SDK and reload:
Hostile-sentinel request scan:
Dashboard/alerts reviewed:
Exceptions / external blockers:
Reviewer:
```
