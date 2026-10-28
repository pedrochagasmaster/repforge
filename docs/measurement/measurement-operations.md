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
change SDK behavior. Record which settings were inspected and actually changed;
a repository merge does not reconcile live PostHog configuration.

Before interpreting a release, confirm the project ID/timezone, explicit
app-version range, and private attribution roster using
[`posthog-measurement-setup.md`](posthog-measurement-setup.md). Do not use the
empty person-property test cohort as evidence that founder traffic is excluded.
Keep internal and unclassified traffic visible in diagnostics, not pilot metrics.

## Live verification — 2026-10-28 (#529)

Read-only `project-get` inspection of project **572717** (UTC), through the
connected PostHog app, confirmed the following project configuration. No live
settings or data were changed.

| Setting | Observed value | Assessment against required state |
|---|---|---|
| `anonymize_ips` | `false` | IP minimization remains unresolved; this setting alone does not establish which IP the ingestion proxy stores or geolocation retention. |
| `autocapture_opt_out` | `false` | Project allows autocapture; the client's five-action allowlist still needs live ingestion verification. |
| `autocapture_web_vitals_opt_in`, `capture_performance_opt_in`, `capture_console_log_opt_in` | `true` | Drift from the runbook's disabled requirement; client disables these paths, but project reconciliation remains a release gate. |
| `capture_dead_clicks` | `false` | Matches required state. |
| `session_recording_opt_in` | `true` | Enabled; does not prove an eligible recording was captured safely. |
| `session_recording_masking_config` | `maskAllInputs: true` | Input masking set; text/attribute masking and blocked regions still require actual recording inspection. |
| `session_recording_sample_rate`, minimum duration, linked flag | `null` | No explicit values returned; do not equate null with verified 100% eligible sampling. |
| `session_recording_network_payload_capture_config` | `null` | No explicit project configuration returned; does not prove bodies/headers absent. |
| `session_recording_retention_period` | `30d` | Observed retention, not a new policy approval. |

This connection exposes project reads but no project-update or replay-read
operation. Person-profile provenance, IP/geo values at rest, replay masking,
retention approval, and successful controlled production ingestion remain
**unverified**. The historical #529 counts remain historical; this settings
inspection neither confirms a current data leak nor clears the privacy gate.
SDK configuration and [PostHog's anonymous-event documentation](https://posthog.com/docs/libraries/js/usage#anonymous-and-identified-events)
are separate from project and stored-data evidence.

The startup-delivery slice uses a memory-only FIFO of at most 64 validated,
consent-eligible events while the SDK adapter is unavailable. It retains the
earliest events, refuses overflow, and clears on opt-out or installation-storage
changes. Attachment drains once, preserving the original occurrence time via
SDK transport options ([timestamp semantics](https://posthog.com/docs/data/timestamps)).
It does not persist events across reload or promise delivery through a permanently
blocked SDK. Module/browser adapter proofs do not replace the controlled
production-ingestion matrix below. The first-working-set milestone correction
and other #529 checklist items remain separate work.

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
| Working/terminal event missing SDK session ID | 1 event | Report uncorrelated events separately; inspect adapter/deploy before interpreting session reliability | Founder |

Subscribe to a threshold alert where PostHog supports the exact query.
Otherwise add the invariant to the daily alpha checklist. An alert is not
complete until the owner and response are recorded. SQL table definitions do
not automatically create alerts.

Run completeness/channel checks before the scorecard inclusion predicates;
otherwise the missing/invalid events disappear. Keep historical pre-schema-1
traffic separated from current-release incidents. The compiled collection check
is not a full property/value leakage audit or automatic-settings audit.

## Silence and replay checks

Silence becomes actionable only after at least three opted-in installations
produced `app_boot` in the prior seven days:

- 48 hours with no production boot: verify deployment, proxy, blockers, and
  tester eligibility;
- 72 hours with boots but no other product event: verify boundary rejection,
  SDK loading, and call-site releases;
- after 20 eligible opted-in sessions, replay availability below 80%: separate
  opt-out, browser blocking, SDK failure, and ingestion failure before acting.

These are pipeline checks, never product-success thresholds. Independently of
those thresholds, a known opted-in smoke journey with missing expected events
requires investigation. Missing iOS events alone are not evidence of iOS churn.
Do not add a blanket bot exclusion: a privacy-minimized payload may be labelled
as automation because it has no user agent. Do not reintroduce identifying
metadata to appease that classifier.

Derive replay eligibility from opted-in SDK sessions, not schema labels on
`$snapshot` events, which intentionally have a different envelope.

## Production deploy smoke

Run within 30 minutes of each production deploy:

1. Record commit SHA, generated `app_version`, production URL, tester/browser,
   start time, project ID/timezone, and private roster revision. Register the
   confirmed synthetic installation IDs before interpreting production rates.
2. On a clean install, confirm exactly one `app_boot` with the declared common
   and event properties, permitted transport IDs, and no person profile or
   extra URL/DOM metadata. Do not require `$host` or a user-agent property.
3. Choose a program route explicitly and activate it; verify the expected
   closed events and duplicate expectations. Each onboarding screen should
   report one `onboarding_step_viewed`, and each screen left forward one
   `onboarding_step_completed`, keyed by route and step id (Plan 071).
4. Log and finish a synthetic session; verify only bucketed counts/duration.
   Then start another session and save a set: verify `set_saved` again without
   requiring the installation-once `first_set_logged` event to repeat.
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
   failure must not change product results. Exercise delayed/blocked SDK loading
   and confirm whether the expected boot reaches ingestion after startup; a
   test adapter installed before app boot does not verify real CDN/SDK timing.
10. Confirm synthetic production traffic is excluded by the private internal
    roster, even though its `release_channel` is `production`. Do not delete
    events or rely only on preview filters. A newly rotated ID needs confirmation.

Complete this matrix on actual devices; emulation is supporting, not substitute,
evidence. Record exact versions, outcomes, and private controlled windows.

| Context | Clean and returning boot | Activate, save, finish, second-session save | Offline / SDK failure | Opt-out and reload |
|---|---|---|---|---|
| Android Chrome tab | Required | Required | Required | Required |
| Installed Android PWA | Required | Required | Required | Required |
| iOS Safari tab | Required | Required | Required | Required |
| Installed iOS PWA | Required | Required | Required | Required |
| Any other iOS browser used for testing | Required if used | Required if used | Required if used | Required if used |

Verify successful ingestion of each expected event in PostHog, not just local
console/network initiation. Record missing events as collection failures until
investigated. Inspect the deployed config/version, consent, blocked/late SDK,
proxy response, and outbound boundary before attributing loss to user behavior.
Also check Cancel/back navigation on current Safari: historical rage-click and
generic-error samples do not establish a current defect or justify a speculative
UI rewrite. Do not claim performance regression from tiny legacy LCP samples.

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

Do not paste installation IDs, rosters, compiled definitions, setup payloads,
workout data, notes, full URLs, or replay contents into GitHub, public logs, or
the PR body. Keep correlation evidence in the private operations record.

## Release evidence template

```text
Commit / app_version:
Deployment / project ID / timezone:
Private roster revision (no IDs here):
Smoke start/end:
Device/browser/PWA matrix:
Clean + returning + offline + delayed SDK:
Product events and duplicate audit:
Autocapture allowlist:
Replay masking:
Opt-out before/after SDK and reload:
Hostile-sentinel request scan:
Dashboard definitions executed / legacy charts labelled:
Alerts and live project settings reviewed:
Exceptions / external blockers:
Reviewer:
```
