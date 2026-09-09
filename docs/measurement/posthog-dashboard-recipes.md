# PostHog dashboard recipes — alpha schema 1

These are versioned build recipes. They are authoritative when the PostHog
project cannot export a stable dashboard definition. Product-scorecard insights
inherit the global filters in [`alpha-scorecard.md`](alpha-scorecard.md): schema
`1`, production channel, explicit app-version range, confirmed pilot roster,
and the recorded project timezone. Health checks are explicit exceptions.

Generate the baseline definitions with
[`build-posthog-measurement.mjs`](../../tools/build-posthog-measurement.mjs).
See [the private roster and migration procedure](posthog-measurement-setup.md).
The compiler is offline: generating definitions does not change PostHog.
Its ten definitions cover collection health, release inventory, attribution,
boots, milestone reach, saved-set outcomes, first value, and repeat training.
The richer diagnostic funnels below remain manual recipes; milestone reach
is not a conversion funnel. Compiled definitions use fixed observation windows.

Do not carry forward legacy `$host`, pageview, person-property, or blanket bot
filters. Current outbound events intentionally omit host and user-agent fields;
missing-user-agent classification is inconclusive. Never restore those fields
just to make an inherited dashboard filter work.

## Dashboard: Measurement health

| Title | Insight | Query / formula | Breakdown | Alert |
|---|---|---|---|---|
| Production boots by release | Trends | Unique installations performing `app_boot` per day; separate internal, confirmed pilot, and unclassified traffic | `app_version` | Silence rule in operations doc |
| Accepted product events | Trends | Event counts for `RepForgeTelemetry.getEventNames()`; never freeze the taxonomy count in a chart | event name | Investigate unexpected zeros after eligible traffic |
| Duplicate expectation audit | Trends/table | Event count and unique installations for each event; compare with its declared duplicate policy | event name | Manual zero-tolerance review for impossible multiplicity |
| Release/channel inventory | Table | All declared product events in the time window, without production/schema/version inclusion filters | schema, app version, release channel | Investigate preview/test contamination separately |
| Version/schema completeness | Table | Declared product events with missing schema/app/channel or wrong schema; inspect unknown custom events separately | event name / missing field | Threshold 1 event |

Health queries must not first exclude missing labels, preview events, internal
traffic, or unexpected app versions: those are the conditions being audited.
Use the observation window as the outer boundary. The compiled health queries
are not an exhaustive property/value privacy audit; retain the hostile-sentinel,
autocapture, replay, and remote-settings checks in the operations runbook.

## Dashboard: Entry and activation

1. **Program activation — 7 days**: Funnel, unique installations,
   `program_path_selected` → route-specific completion → `program_activated`.
   Conversion window seven days. Attribute the route from selection; do not
   require properties on events that do not carry them. Show path selectors
   as denominator. `app_boot` is a separate entry/collection diagnostic.
2. **Free-form import funnel**: Funnel, unique installations,
   `program_import_started` → `program_import_handoff` → `program_import_parsed` →
   `program_import_review_reached` → `program_activated`. Apply `source=freeform`
   only on steps that declare `source`; do not apply it globally to handoffs.
   Break down handoffs by `method`/`outcome`, and parse results by `outcome`.
   File import is a separate path and must not require an assistant handoff.
3. **Generator completion**: Funnel, unique installations,
   `generator_started` → `generator_completed` → `program_activated`; seven
   days. Break down completion by `goal`, `frequency`, and `family` one at a
   time so property absence is visible rather than coerced.
4. **Activation versions**: Trends, unique installations performing
   `program_activated`; break down by `version_category` and `app_version`.

For every conversion rate, show mature eligible and pending installations
separately. An unfinished conversion window is not a failed conversion.

## Dashboard: First useful workout

1. **Activation to first completed session — 14 days**: Ordered
   `program_activated` → `first_set_logged` → `session_completed`; fourteen days
   from activation. `first_set_logged` is installation-once, not an activation
   or every-session start. The compiled view conservatively requires a
   witnessed first-run boot in the same observation range, excluding installations
   without that observed boot. Show eligible,
   completed, and pending counts; divide only the mature numerator by the mature
   denominator. Do not silently compare this restricted view with all activations.
2. **First-value lag**: Time-to-convert for `program_activated` →
   `first_set_logged`; unique new installations, fourteen-day cap. This is
   journey elapsed time, not generator processing latency.
3. **First-session shape**: Trends for `session_completed`, event count,
   separately broken down by `set_count`, `exercise_count`, and `duration`.
   Values are coarse buckets, never reconstructed numbers.

A witnessed `first_run=true` boot is an observation filter, not proof of a
first-ever installation or person. Confirm recruitment/history in the private
roster; resets and missing early events can change eligibility. Label the
compiled cohort as **first-run-observed**, not all new or returning users.

Returning-installation activation to `set_saved` is a separate reactivation
view, not a replacement for the first-ever milestone metric.

## Dashboard: Session completion and abandonment

1. **Session outcome**: Group by `(distinct_id, $session_id)`, with sessions
   containing `set_saved` as denominator. Count completion (`session_completed`
   or `one_off_completed`) or explicit `session_abandoned` only after the first
   saved set in that SDK session. Separate unresolved, duplicate, and conflicting
   terminal cases. Exclude missing SDK session IDs and report them in health.
2. **Explicit abandonment reasons**: Trends, `session_abandoned` event count,
   broken down by `stage` and then `reason`. Pre-set abandonment is outside the
   saved-set denominator but remains visible here.
3. **Completion duration**: Trends, `session_completed` event count, breakdown
   `duration`; inspect one-off completions separately where relevant.

`first_set_logged` cannot start this denominator: it misses every later session.
SDK sessions are not durable workout identities. A reload can split a workout;
several workouts may share one SDK session. Do not reconstruct training records
or invent an identifier to hide that limitation. Sessions without a terminal
event are unresolved, not inferred abandonment or evidence of data loss.

## Dashboard: Recommendation understanding and override

1. **Explanation path**: Diagnostic ordered path, `set_saved` →
   `recommendation_explained` → later `set_saved`; report installation reach and
   SDK-session correlation separately. Break down explanations by `surface`.
   This view excludes explanations before the first save; include their direct
   event reach separately. It measures investigation, not comprehension.
2. **Suggestion response**: Trends, `set_saved` event count and unique
   installations, breakdown `vs_suggestion`.
3. **Deliberate overrides**: Trends, `recommendation_overridden` event count,
   breakdown `reason`, keeping missing optional reason as its own group.

## Dashboard: Repeat training

Anchor on the first observed `session_completed` in the declared observation
range. Compiled D7/D30/D60 views use confirmed pilots with witnessed first-run
boots, rather than silently treating every first event in a query range as lifetime-first use. A repeat
requires completion on a later UTC date, with a different SDK session ID,
within N elapsed days of the anchor. This is **repeat within N days**, not
exact-day retention or proof of N days of sustained use.

At the explicit `asOf` timestamp, include only anchors old enough for the full
window in both numerator and denominator. Show pending installations and return
`null`, not zero percent, for an empty eligible cohort. Breakdowns by activation
route/version require earlier-event attribution; do not copy those properties
onto `session_completed`. Duplicate expectations must pass before interpretation.

## Dashboard: Privacy and automatic-product availability

1. **Opt-out rate**: operational denominator from installs observed in the
   release smoke and tester roster; the client intentionally emits no opt-out
   event. Do not infer opt-out from missing traffic alone.
2. **Replay availability**: eligible opted-in PostHog sessions with a replay /
   eligible opted-in sessions. Interpret only after 20 eligible sessions.
   Replays do not carry the same product-event schema labels; join by eligible
   SDK session, rather than filtering snapshots as product events.
3. **Autocapture actions**: `$autocapture` event count, breakdown only by the
   closed `telemetry_action` field. Expected values are `nav_today`,
   `nav_progress`, `nav_history`, `nav_program`, and `settings_open`.
4. **Unexpected autocapture shape**: query `$autocapture` events where the
   action is missing/outside the closed set or where forbidden DOM/URL
   properties survived. Threshold: one event.

## Dashboard: Schema and app-version comparison

Trends by `app_version` for `app_boot`, `program_activated`,
`first_set_logged`, and `session_completed`, plus an event-volume table by
app version. Never compare conversion across releases until event definitions
and duplicate audits match; annotate mixed-version windows. Keep legacy charts
labelled as historical; do not blend pre-contract events with schema 1.

## Build record

For each live insight record in this file or its linked private operations log:

- PostHog title, ID, and dashboard;
- insight type and recipe revision;
- exact filters, breakdown, and formula;
- unit, conversion window, and mature/pending counts;
- project timezone and fixed observation start/end;
- schema/app/channel constraints and roster revision;
- creation/review date; and
- whether a threshold alert is supported or the check is manual.

Keep actual installation IDs and compiled definitions out of the public repo.
