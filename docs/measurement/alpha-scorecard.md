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
- collection was permitted by the installation's opt-in state; and
- the event name and properties pass the closed client schema.

Validation scorecards additionally use the confirmed independent pilot roster.
Report internal/test and unclassified installation traffic separately; neither
is evidence of independent adoption. Use existing anonymous `distinct_id`
values, not a person-property cohort that requires profiles. The roster and
confirmation evidence remain private. See
[`posthog-measurement-setup.md`](posthog-measurement-setup.md).
An empty pilot roster must not fall back to all non-internal traffic.
Opt-out has no telemetry event: absence alone cannot establish its cause.

Use the PostHog project timezone for charts and record that timezone in every
saved insight. Do not mix preview traffic into a production scorecard. Never
add a workout, program, exercise, or user identifier to make a query easier.
Do not inherit `$host` or blanket bot filters: the closed payload intentionally
omits host and user-agent fields. Missing metadata is not proof of automation.
Health queries are explicitly broader so bad or absent labels remain visible.

## Funnel contracts

| Funnel | Ordered steps | Unit | Window | Breakdown | Denominator |
|---|---|---|---|---|---|
| Program activation | `program_path_selected` → route completion (`generator_completed` or `template_selected` where applicable) → `program_activated` | Unique installation | Path selection through 7 days | route; generator goal/frequency/family where present | Installations with `program_path_selected`; mature and pending counts separately |
| Free-form program import | `program_import_started` → `program_import_handoff` → `program_import_parsed` → `program_import_review_reached` → `program_activated` | Unique installation | 7 days | source on steps that declare it; handoff method/outcome; parse outcome | Free-form import starters; file import is a separate path |
| First gym-floor value | `program_activated` → `first_set_logged` → `session_completed` | Unique new installation | Activation through 14 days | activation route and version category; family only when supplied by the earlier generator event | New installations with activation; compiled view requires a witnessed first-run boot, with mature and pending cohorts separate |
| Recommendation understanding | `set_saved` → `recommendation_explained` → later `set_saved` | Report both unique installation and event count | Active program observation window | explanation surface; `vs_suggestion` | Saved-set installations; all explanation opens shown separately, including those before a save |
| Session reliability | `set_saved` → `session_completed`, `one_off_completed`, or explicit `session_abandoned` | Installation + PostHog SDK session | One SDK session | completion duration; abandonment stage/reason | SDK sessions containing `set_saved`; missing session IDs reported separately |
| Repeated use | first observed `session_completed` → later-date, different-SDK-session `session_completed` | Unique new installation | Repeat within 7, 30, or 60 elapsed days | activation route and version category | Mature anchors; compiled view requires a witnessed first-run boot |

`app_boot` is a separate entry/collection diagnostic, not a prerequisite that
changes the path-selector denominator. `first_set_logged` is installation-once:
it cannot measure every later session or every reactivation. Returning-installation
activation to a saved set requires a separately labelled view.

The compiled first-value and repeat views are conservative new-installation
subsets, not all-activation or lifetime-history metrics. Show excluded returning
or incomplete-history installations separately; do not count them as failures
or compare their rates silently with wider historical cohorts. Keep the full
schema-compatible release history needed by the observation window.

`session_abandoned` is counted only when the product exposes and records an
explicit abandonment action. Page closure is not abandonment. Count terminal
events only after a saved set in the same SDK session; separate unresolved,
duplicate, and conflicting terminals. Pre-set abandonment remains a separate
reach/reason view. SDK sessions can split on reload or span multiple workouts;
they are not durable workout identities, and no stable workout ID is allowed.

A witnessed `first_run=true` boot is an observation filter, not proof of a
first-ever installation or person. Confirm recruitment/history in the private
roster; resets and missing early events can change eligibility. Label the
compiled cohort as **first-run-observed**, not all new or returning users.

## Scorecard hierarchy

### 1. Save reliability

- Automated evidence: browser save-path correctness and local save-latency
  budget.
- Telemetry evidence: saved-set SDK sessions that end in completed or explicit
  abandoned state, alongside unresolved/missing-correlation counts.
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

For each N-day view, include only anchors at least N elapsed days old at the
recorded `asOf` timestamp in both numerator and denominator. A repeat must occur
on a later project-calendar date and in a different SDK session, within that
window. This is repeat-within-N, not exact-day retention. Show returning,
eligible, and pending counts; no eligible denominator means undefined, not 0%.
Annotate known interruption, churn, and recruitment pauses; do not treat a
rolling organic alpha as a fixed acquisition cohort.

## Chart annotation contract

Every saved insight or exported reading records:

1. unit: event, PostHog SDK session, or unique installation;
2. inclusion and exclusion rules, including private roster revision;
3. numerator, eligible denominator, and pending count;
4. observation window, as-of timestamp, and timezone;
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
