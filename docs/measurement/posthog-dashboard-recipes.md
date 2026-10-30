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
Its fifteen definitions cover collection health, release inventory,
attribution, boots, milestone reach, saved-set outcomes, first value, repeat
training, and (Plan 071) onboarding step reach, onboarding last step reached,
activation by route, recommendation edits at activation, and week-1/week-4
training by route.
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

## Dashboard: Onboarding funnel (Plan 071)

Steps are ProgramEntry ids, not screen positions. Order each route's rows by
`ProgramEntry.ROUTE_STEPS`; the hub is `route=none, step=entry`. A step added
by a later onboarding change appears as a new row without a recipe change.

1. **Step reach** (compiled `onboarding-steps`): unique installations viewing
   and completing each `{route, step}`, back events, and completions in the
   `3_10m` / `over_10m` buckets. A step whose completed count falls well below
   its viewed count is where lifters stop. A high back count marks the step
   before it as the confusing one.
2. **Last step reached** (compiled `onboarding-drop-off`): for each
   installation, the last step viewed and whether it activated. Read
   `dropped_mature` only; `pending` installations may still finish.
3. **Activation by route** (compiled `activation-by-route`): installations
   attributed to their first selected route, 7-day mature rate.
4. **Time on step**: Trends, `onboarding_step_completed` event count,
   filter one route, breakdown `step`, then `time_on_step`. Buckets only;
   never reconstruct seconds.
5. **Who stops**: Funnel, unique installations,
   `onboarding_step_completed{step=schedule}` →
   `onboarding_step_completed{step=environment}` → `program_activated`.
   Break down by `days_per_week`, then `session_length`, then `gym_preset`,
   one at a time. Repeat for `goal` and `experience` at their steps. A
   breakdown value with under 10 installations is not read.
6. **Generation health**: Trends, `generation_settled` event count, breakdown
   `outcome`, then `duration`. A success that lands in `3_10s` or `over_10s`
   is a stall the lifter watched. Compare app versions across the Worker
   change (#353), since the event means the same either way.
7. **Leaving and resuming**: Trends, `onboarding_exit` by `action` and
   `step`; `onboarding_resume_offered` by `status`; funnel
   `onboarding_exit{action=keep_draft}` → `onboarding_started{resumed=true}`
   within 7 days.
8. **Activation failures**: Trends, `program_activation_failed` by `reason`
   and `route`. Threshold: any `definition_invalid` is a defect.

## Dashboard: Recommendation editor (Plan 071)

1. **Edits at activation** (compiled `editor-reliance`): generated-route
   activations by `review_changes`. `0` means the recommendation was accepted
   as built; `not_reported` comes from releases before the property and is
   not zero.
2. **What lifters change**: Trends, `program_review_action` with
   `action=edit`, breakdown `kind`; unique installations and event count.
3. **Second thoughts**: Trends, `program_review_action` for `undo` and
   `restore`, against `edit`. Many undos of one kind point at a control that
   misleads.
4. **Editor failures**: `program_review_action` for `refused` and
   `save_failed`, breakdown `kind`. Threshold: any `save_failed` is
   investigated.

## Dashboard: Landing and install (Plan 071)

1. **Landing outcome**: Trends, `landing_viewed` by `landing` and `visit`;
   `landing_action` by `action`. Create and import over first-visit views is
   the landing's conversion. Filter `action = proof_chapter` and break down by
   `chapter` (1–4) to see which parts of the playing proof lifters tap back to;
   autoplay never reports, so every count is a tap.
2. **Install offers**: Trends, `install_prompt_outcome` by `surface`, `mode`
   and `outcome`. For native prompts, acceptance is `accepted` over `prompted`.
   iOS and manual offers can only report that instructions were shown.
3. **Installed share**: Trends, unique installations performing `app_boot`
   by `display_mode`. `app_installed` is Chromium's report and undercounts
   iOS.

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
4. **Return gap**: Trends, `session_completed` event count, breakdown
   `days_since_last`; weekly. A shift toward `8_14` and longer is lifters
   slipping before they stop. `first` marks each installation's first saved
   session.

A witnessed `first_run=true` boot is an observation filter, not proof of a
first-ever installation or person. Confirm recruitment/history in the private
roster; resets and missing early events can change eligibility. Label the
compiled cohort as **first-run-observed**, not all new or returning users.

Returning-installation activation to `set_saved` is a separate reactivation
view, not a replacement for the first-ever milestone metric.

## Dashboard: Session completion and abandonment

1. **Session outcome** (compiled `session-outcomes`): Group by
   `(distinct_id, $session_id)`, with sessions containing `set_saved` as
   denominator. Count completion (`session_completed`), explicit abandonment
   (`session_abandoned`) or discard by a program edit (`workout_discarded`)
   only after the first saved set in that SDK session. Separate unresolved,
   duplicate, and conflicting terminal cases. Exclude missing SDK session IDs
   and report them in health. Unresolved is not abandoned.
2. **Why sessions end early**: Trends, `session_abandoned` event count,
   breakdown `stage`, then `reason`, keeping a missing reason as its own
   group. Abandonment before any set is outside the saved-set denominator but
   stays visible here. Compare with Finish early (`session_completed` with
   few sets) before reading abandonment as failure.
3. **Discarded workouts**: Trends, `workout_discarded` event count, broken
   down by `stage`.
4. **Completion duration**: Trends, `session_completed` event count, breakdown
   `duration`.

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
3. **Overrides**: Trends, `set_saved` with `vs_suggestion` in (`raised`,
   `lowered`), as a share of sets with a suggestion. No reason is collected.

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

## Dashboard: Week-1 and week-4 training by route (Plan 071)

Compiled `retention-by-route`. Anchor: the first `program_activated` of a
first-run-observed installation, attributed to its route. Week 1: a
`session_completed` on a later UTC date within 7 days. Week 4: one in elapsed
days 22–28. Each week counts only mature anchors and shows pending ones. Read
a route only after 10 eligible installations in it.

## Dashboard: Block and program management (Plan 071)

1. **Block continuation**: funnel, `block_review_viewed` →
   `block_transition_chosen` within 14 days; breakdown `action`.
2. **In-workout swaps**: Trends, `substitution_used` by `source`, then by
   `reason` with a missing reason as its own group. An alternate share near
   zero means the slot alternates go unseen. A rising `pain` share is a
   programming signal to review, never an automated intervention.
3. **Program edits**: Trends, `active_program_edited` by `outcome`.
4. **Settings**: Trends, `settings_changed` by `setting`.

## Dashboard: Program sharing

`share_setup_outcome` is the evidence for the Evidence-only "Encrypted
server-backed setup links" backlog item. Each Share-sheet open reports one
`link_ready` or `link_refused` (too large for a setup link), then `copied`,
`shared` or `file_shared` when the lifter acts. Every outcome carries
`program_kind` (`generated`, `generated_edited`, `manual`, `other`), `form`
(`recipe` or `full`) and `size_vs_limit` (`under_half`, `under_limit`,
`over_limit`, `over_2x`, `over_4x` against the link limit). No program
content, names or sizes in bytes are sent.

1. **Link refusal rate**: Trends, unique installations performing
   `share_setup_outcome` with `action=link_refused` / unique installations
   with `action` in (`link_ready`, `link_refused`); weekly. Interpret only after
   50 attempting installations on one app version.
2. **Refusals by program kind and size**: Trends, `action=link_refused`,
   breakdown `program_kind`, then `size_vs_limit`. Shows whether refusals come
   from edited generated programs (a recipe-plus-edits link would fit) or
   from Build and imported programs (only a hosted store would).
3. **File fallback follow-through**: Funnel, unique installations,
   `share_setup_outcome` `action=link_refused` → `share_setup_outcome`
   `action=file_shared`; one-hour conversion window. A low conversion means
   the file is not an acceptable substitute for a link.
4. **Link completion**: Funnel, `action=link_ready` → `action` in
   (`copied`, `shared`); one-hour window, breakdown `form`. The baseline the
   refused path is compared with.

The reopen thresholds are in the backlog item; do not lower them after
looking at the data.

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
