# Alpha measurement scorecard

Status: executable measurement contract for telemetry schema `1`.

This document defines how Taurifer reads alpha evidence. The event schema in
[`telemetry.js`](../../telemetry.js) is authoritative. Dashboard construction
follows [`posthog-dashboard-recipes.md`](posthog-dashboard-recipes.md), and
release/incident operations follow
[`measurement-operations.md`](measurement-operations.md).

## Global inclusion rule

Unless a row explicitly says otherwise, include only events where:

- `telemetry_schema_version = 1`;
- `release_channel = production`;
- `app_version` is present and belongs to the release range under review;
- the installation has not opted out; and
- the event name and properties pass the closed client schema.

Use the PostHog project timezone for charts and record that timezone in every
saved insight. Do not mix preview traffic into a production scorecard. Never
add a workout, program, exercise, or user identifier to make a query easier.

## Funnel contracts

| Funnel | Ordered steps | Unit | Window | Breakdown | Denominator |
|---|---|---|---|---|---|
| Program activation | `app_boot` → `program_path_selected` → route completion (`generator_completed` or `template_selected` where applicable) → `program_activated` | Unique installation | Path selection through 7 days | route; generator goal/frequency/family where present | Installations with `program_path_selected` |
| First gym-floor value | `program_activated` → `first_set_logged` → `session_completed` | Unique installation | Activation through 14 days | activation route and version category; family only when supplied by the earlier generator event | Installations with `program_activated` |
| Recommendation understanding | `first_set_logged` → `recommendation_explained` → later `set_saved` | Report both unique installation and event count | Active program observation window | explanation surface; `vs_suggestion` | Installations with `first_set_logged`; events with `set_saved` for event-rate views |
| Session reliability | `first_set_logged` → `session_completed` or explicit `session_abandoned` | PostHog session | One PostHog session | completion duration; abandonment stage/reason | Sessions containing `first_set_logged` |
| Repeated use | first `session_completed` → later `session_completed` | Unique installation | D7, D30, D60 eligibility cohorts | activation route and version category | Installations whose first completion is old enough for the stated window |

`session_abandoned` is counted only when the product exposes and records an
explicit abandonment action. Page closure is not abandonment. PostHog session
scope is the session correlation mechanism; no stable workout ID is allowed.

## Scorecard hierarchy

### 1. Save reliability

- Automated evidence: browser save-path correctness and local save-latency
  budget.
- Telemetry evidence: sessions containing a first set that end in completed or
  explicit abandoned state.
- Operational evidence: tester reports of loss, duplication, or stale data.

Do not infer data safety from telemetry alone: a capture failure and a product
save failure are intentionally independent.

### 2. Progression trust

Report explanation opens, suggestion match/raise/lower/no-suggestion buckets,
and deliberate overrides. Pair these with interview evidence. An explanation
open shows investigation, not understanding; a matched suggestion shows
behavior, not trust.

### 3. Switching proof

Ask participants directly whether they stopped consulting their previous
spreadsheet, notes, or app. This is interview evidence. Taurifer telemetry
cannot infer it and no proxy chart may be labelled as switching proof.

### 4. Retention outcome

Report a second completed session only after the installation is eligible for
the D7, D30, or D60 window. Show numerator and eligible denominator together.
Annotate known interruption, churn, and recruitment pauses; do not treat a
rolling organic alpha as a fixed acquisition cohort.

## Chart annotation contract

Every saved insight or exported reading records:

1. unit: event, PostHog session, or unique installation;
2. inclusion and exclusion rules;
3. numerator and denominator;
4. observation window and timezone;
5. schema, release channel, and app-version filters;
6. evidence class: product telemetry, interview, automated, or operational;
7. minimum denominator before interpretation; and
8. the date and person who last checked the recipe against the live project.

Alpha readings are descriptive. No conversion target or launch threshold is
authorized by this scorecard.

## Duplicate expectations

Use `RepForgeTelemetry.getEventPolicy(name)` when auditing event counts.
`once_per_boot`, `once_per_setup_flow`, `once_per_session`, `milestone`, and
`repeatable` are analysis expectations, not client suppression rules. A breach
is investigated as a possible duplicate-emission defect before a chart is
interpreted.

## Reading cadence

- Daily while testers are active: measurement health and privacy invariants.
- After each production deploy: clean-install smoke and app-version split.
- Weekly: entry, first workout, reliability, and recommendation views with raw
  denominators.
- At D7/D30/D60 eligibility boundaries: repeat-use cohorts.
- After each participant check-in: update interview evidence separately from
  product telemetry.
