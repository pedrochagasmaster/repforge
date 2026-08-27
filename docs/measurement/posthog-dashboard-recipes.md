# PostHog dashboard recipes — alpha schema 1

These are manual, versioned build recipes. They are authoritative when the
PostHog project cannot export a stable dashboard definition. Every insight
inherits the global filters in
[`alpha-scorecard.md`](alpha-scorecard.md): schema `1`, production channel,
explicit app-version range, and the recorded project timezone.

## Dashboard: Measurement health

| Title | Insight | Query / formula | Breakdown | Alert |
|---|---|---|---|---|
| Production boots by release | Trends | Unique installations performing `app_boot` per day | `app_version` | Silence rule in operations doc |
| Accepted product events | Trends | Event count for the 20 schema-1 product event names | event name | Investigate unexpected zeros after eligible traffic |
| Duplicate expectation audit | Trends/table | Event count and unique installations for each event; compare with its declared duplicate policy | event name | Manual zero-tolerance review for impossible multiplicity |
| Preview exclusion | Trends | Count where `release_channel != production` inside a copied production filter set | release channel | Threshold 1 included event |
| Version/schema completeness | Trends | Product events missing schema/app/channel, plus wrong schema | missing field / value | Threshold 1 event |

## Dashboard: Entry and activation

1. **Program activation — 7 days**: Funnel, unique installations,
   `program_path_selected` → route-specific completion → `program_activated`.
   Conversion window seven days. Break down by `route` from selection and
   activation. Show total path selectors as denominator.
2. **Generator completion**: Funnel, unique installations,
   `generator_started` → `generator_completed` → `program_activated`; seven
   days. Break down completion by `goal`, `frequency`, and `family` one at a
   time so property absence is visible rather than coerced.
3. **Activation versions**: Trends, unique installations performing
   `program_activated`; break down by `version_category` and `app_version`.

## Dashboard: First useful workout

1. **Activation to first completed session — 14 days**: Funnel, unique
   installations, `program_activated` → `first_set_logged` →
   `session_completed`; fourteen-day window.
2. **First-value lag**: Time-to-convert for `program_activated` →
   `first_set_logged`; unique installations, fourteen-day cap.
3. **First-session shape**: Trends for `session_completed`, event count,
   separately broken down by `set_count`, `exercise_count`, and `duration`.
   Values are coarse buckets, never reconstructed numbers.

## Dashboard: Session completion and abandonment

1. **Session outcome**: Funnel from `first_set_logged` to either
   `session_completed` or `session_abandoned`, grouped by PostHog session.
2. **Explicit abandonment reasons**: Trends, `session_abandoned` event count,
   broken down by `stage` and then `reason`.
3. **Completion duration**: Trends, `session_completed` event count, breakdown
   `duration`.

Do not treat sessions with neither terminal event as abandonment until the
product has an explicit action and a verified event path.

## Dashboard: Recommendation understanding and override

1. **Explanation path**: Funnel, unique installations,
   `first_set_logged` → `recommendation_explained` → `set_saved`; active-program
   observation window. Break down the middle event by `surface`.
2. **Suggestion response**: Trends, `set_saved` event count and unique
   installations, breakdown `vs_suggestion`.
3. **Deliberate overrides**: Trends, `recommendation_overridden` event count,
   breakdown `reason`, keeping missing optional reason as its own group.

## Dashboard: Repeat training

Build one retention insight anchored on the first `session_completed`, with
return event `session_completed`, and save D7, D30, and D60 views. Use unique
installations. Export the eligible cohort size beside the returning count.
Breakdowns by activation route/version require a cohort or joined earlier
event; do not copy a later property onto `session_completed`.

## Dashboard: Privacy and automatic-product availability

1. **Opt-out rate**: operational denominator from installs observed in the
   release smoke and tester roster; the client intentionally emits no opt-out
   event. Do not infer opt-out from missing traffic alone.
2. **Replay availability**: eligible opted-in PostHog sessions with a replay /
   eligible opted-in sessions. Interpret only after 20 eligible sessions.
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
and duplicate audits match; annotate mixed-version windows.

## Build record

For each live insight record in this file or its linked operations log:

- PostHog title and dashboard;
- insight type;
- exact filters, breakdown, and formula;
- unit and conversion window;
- project timezone;
- schema/app/channel constraints;
- creation/review date; and
- whether a threshold alert is supported or the check is manual.
