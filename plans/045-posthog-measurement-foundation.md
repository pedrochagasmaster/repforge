# Plan 045: strict PostHog boundary and alpha measurement foundation

## Status

- **State:** READY FOR IMPLEMENTATION
- **Priority:** P0 — first item in the canonical alpha queue
- **Effort:** L
- **Risk:** HIGH — analytics sits beside local training, setup-link, and
  user-authored data that must never escape accidentally
- **Depends on:**
  [Plan 044](./044-posthog-measurement-experiments-paywall.md),
  [ADR 0010](../docs/adr/0010-product-business-thesis-and-validation-sequencing.md),
  the [business/product thesis](../docs/business-product-thesis.md), and the
  [decision register](../docs/product-grilling-decision-register.md)
- **Blocks:** trustworthy alpha recruitment and every later experiment
- **Phase gate satisfied:** Plan 044 Phase A measurement contract

## Outcome

Taurifer has one small, testable analytics boundary. Product code can emit
only reviewed events with reviewed, coarse properties. PostHog may be blocked,
offline, opted out, or broken without affecting app behavior. Default-on
autocapture and replay may operate only inside the explicit privacy boundary
defined here.

The implementation also leaves a versioned specification for the alpha
funnels, denominators, observation windows, dashboard ownership, and
measurement-health checks. A chart is not accepted merely because events
appear in PostHog.

## Why this is a separate plan

Plan 044 governs the entire path from measurement through paid beta. This plan
implements only its first technical contract. It does not build lifecycle
reasons, progression, program families, onboarding, Pro, checkout, research
feedback storage, or AI.

## Current-state audit

The executor must re-check these findings against `HEAD` before editing:

- `posthog-init.js` loads PostHog through the Taurifer reverse proxy and turns
  on automatic exception capture, but does not mechanically freeze replay,
  autocapture, URLs, input text, console, network, surveys, or opt-out.
- `scripts/generate-posthog-config.mjs` generates a production token/proxy
  config and injects `posthog-init.js` into `index.html`.
- `app.js` exposes a generic `captureEvent(event, properties)` passthrough to
  `window.posthog.capture`. Any caller can therefore invent names, properties,
  strings, or values.
- Existing call sites emit events outside Plan 044's catalogue, including
  exact or near-exact counts. There is no schema test preventing recurrence.
- The SDK script is not pinned to one reviewed exact version.
- There is no visible, persistent analytics off switch.
- There is no versioned alpha funnel/dashboard specification.

These are design gaps, not permission to widen analytics.

## Locked decisions

1. Analytics are **pseudonymous**, not anonymous.
2. The random identifier belongs to the installation, not a person, account,
   research cohort, program, or exercise.
3. Research participants use the same identifier and normal product path as
   everyone else.
4. Product events are the measurement source of truth. Autocapture can help
   diagnose interaction behavior but may not redefine metrics.
5. Exact weights, reps, RIR, Capacity, bodyweight, set histories, exercise
   identities, program payloads, setup payloads, notes, and free text never
   enter PostHog.
6. Full URLs are not useful analytics properties. Query strings and fragments
   are always stripped before capture.
7. Default-on analytics require a plain-language disclosure and a persistent
   off switch. Turning the switch off stops custom events, automatic events,
   replay, surveys, errors, logs, heatmaps, flags/experiments that require
   capture, and queued delivery.
8. Replay masks every input and every piece of app text by default. The first
   release has no unmasked dynamic text. A later static-text exception needs a
   reviewed allowlist and a leakage regression.
9. Free-text research submission is not part of this plan. Until a separate
   consented endpoint exists, text remains local.
10. Telemetry cannot be used by boot, storage, workout, progression, export,
    navigation, or entitlement logic.

## Scope

### In scope

- a dependency-free telemetry facade and closed schema;
- a narrow PostHog adapter;
- a stable pseudonymous installation identifier;
- a Settings disclosure and persistent on/off control;
- SDK configuration for identity, replay, autocapture, URLs, automatic
  products, console/network/error capture, and remote configuration;
- migration of existing event calls to the approved catalogue or removal;
- an alpha measurement specification with funnels and observation windows;
- local and browser leakage tests;
- production measurement-health verification.

### Out of scope

- implementing events for product behavior that does not exist yet;
- a feedback backend or transmission of free text;
- user accounts, cross-device identity, cloud sync, or person profiles;
- feature flags or experiments controlling core product behavior;
- fake doors, paywalls, checkout, or paid-beta dashboards;
- session replay review operations or support staffing policy;
- changing the PostHog vendor or proxy architecture.

## Target architecture

### 1. Separate policy from vendor loading

Add `telemetry.js` as a build-free UMD module. It must run in both a browser
and plain Node. It owns:

- the schema version;
- the event registry and validators;
- coarse bucket helpers;
- URL and referrer scrubbing;
- installation-id storage;
- enable/disable state;
- the fail-open `capture` API;
- a narrow adapter contract.

`posthog-init.js` owns only SDK loading and an adapter that satisfies that
contract. `app.js` must never call `window.posthog`, import a token, know the
proxy host, or use `$` event/property names.

The public surface should be no broader than:

```js
RepForgeTelemetry.boot({ adapter, storage, location, navigator })
RepForgeTelemetry.capture(eventName, properties)
RepForgeTelemetry.setEnabled(enabled)
RepForgeTelemetry.isEnabled()
RepForgeTelemetry.getSchemaVersion()
```

Dependencies such as storage, clock, UUID creation, location, and adapter
must be injectable in tests. Calling any method before SDK boot or after an
SDK exception returns harmlessly.

The facade must not create its own persistent or in-memory retry queue. If the
adapter is unavailable, the event is dropped. PostHog's own bounded queue may
handle temporary offline delivery, subject to the opt-out purge and tests
below.

### 2. Own the installation identity

Use a dedicated device-only record, for example
`repforge_telemetry_identity_v1`, containing only:

```json
{
  "schemaVersion": 1,
  "installationId": "random UUID",
  "createdAt": "ISO timestamp"
}
```

Rules:

- create it with `crypto.randomUUID()`; use a tested random fallback only for
  browsers without that API;
- validate the stored shape before reuse and replace corrupt records;
- never derive it from workout data, setup links, browser fingerprinting,
  research records, or user-entered content;
- never include it in backup/export, setup sharing, program sharing, or logs;
- do not rotate it on normal history deletion, opt-out, or language change;
- a future factory-reset feature must explicitly state whether it rotates the
  identifier; that choice is outside this plan;
- initialize PostHog with this ID in the SDK's unidentified-ID mode and set
  `person_profiles: "never"`; never call `identify`, `alias`, group/person
  property APIs, or `$set`/`$set_once`.

Use PostHog's in-memory persistence for analytics state where the pinned SDK
supports the required replay/session behavior. Taurifer's tiny identity record
and the SDK's local-storage opt-out record are the only durable analytics
state. Do not create cookies.

### 3. Freeze a schema, not just a list of names

Every event definition contains:

- the exact event name;
- lifecycle phase (`alpha`, `pro_beta`, or `ai_preview`);
- required and optional properties;
- validator for every property;
- enum members or numeric bucket function;
- whether duplicates are expected;
- a short metric definition.

The wrapper, not callers, attaches three closed transport fields to every
accepted custom event: `telemetry_schema_version`, `app_version`, and
`release_channel` (`production` or `preview`). Their validators are as strict
as product properties: known schema integer, repository-generated version
token, and closed channel enum. They exist so dashboards can exclude mixed
definitions and deployments; they are never derived from user data. Record
them as common properties in the implemented catalogue/specification.

`capture` must reject:

- unknown events;
- properties not declared for that event;
- missing required properties;
- raw numbers where a bucket is required;
- strings outside a closed enum;
- nested objects, arrays, URLs, hashes, IDs, or free text;
- any application property whose name begins with `$`.

Rejection is silent in production and observable through an injected test
hook in development. Do not send a rejection event to PostHog; doing so would
create a second uncontrolled schema.

Keep the Phase A catalogue in Plan 044 authoritative. The code may contain
future event definitions only as disabled phase entries; it must refuse to
emit them until their phase is explicitly enabled by reviewed implementation.

### 4. Migrate today's calls explicitly

Do not preserve an old event merely to avoid deleting a call site.

| Current call | Required action |
|---|---|
| `custom_exercise_created` | Remove. It is not in the frozen alpha catalogue. |
| `workout_started` | Remove. First meaningful gym-floor evidence is `first_set_logged`; do not invent a replacement. |
| `workout_completed` | Replace with `session_completed` and only its approved coarse count/duration buckets. |
| `workout_session_deleted` | Remove. It is not an alpha thesis metric. |
| `backup_exported` | Remove from PostHog. Backup health is tested locally and operationally, not by adding an unreviewed event. |
| `program_imported` | Emit `program_path_selected` when Import is chosen and `program_activated` after explicit activation. Never include program or exercise identifiers. |
| `onboarding_completed` | Replace with approved `generator_completed` and `program_activated` events using closed goal/frequency/family categories. |

Add later catalogue events only at the product action that gives them precise
semantics. For example, `session_abandoned` needs an explicit abandonment
state; page closure alone is not enough.

### 5. Pin and harden PostHog

At implementation time, choose and record one exact supported `posthog-js`
version. Load `/static/<exact-version>/array.js` through the existing proxy and
retain strict script versioning. A dependency update is a reviewed change with
privacy tests, not an automatic latest-version fetch.

The final explicit configuration must include at least:

- `person_profiles: "never"`;
- no cookies and no automatic identity merging;
- `capture_pageview: false` and `capture_pageleave: false`;
- `capture_exceptions: false` until a separately schema-safe error boundary
  exists;
- `capture_performance: false`;
- heatmaps, dead clicks, rage clicks, console logs, surveys, and remote flags
  disabled unless this plan gives them an allowlisted path;
- `logs.captureConsoleLogs: false`;
- local-storage opt-out persistence;
- an explicit `before_send` final guard;
- no tracing headers;
- no request/response bodies or headers in replay;
- replay input and text masking described below.

Project-level PostHog settings can otherwise re-enable products remotely.
Record the required project settings in the measurement specification and add
a production smoke checklist. If a product cannot be mechanically disabled
from application code, its remote state is part of the release gate.

PostHog's current official documentation for the options must be checked
against the pinned version during implementation:

- <https://posthog.com/docs/libraries/js/config>
- <https://posthog.com/docs/privacy/data-collection>
- <https://posthog.com/docs/session-replay/privacy>

### 6. Permit only controlled autocapture

Autocapture may be default-on only for deliberately marked, static controls.
Use a closed `data-telemetry-action` enum on reviewed buttons/links. Configure
the SDK to accept only click events on those selectors and element types.

The `before_send` guard must reject every `$autocapture` event that lacks a
registered action. For an accepted event, rebuild the property object from the
minimum required SDK/session fields plus the closed action token. Strip:

- element text and child text;
- HTML, class lists, DOM paths, CSS selectors, and element chains;
- `id`, `name`, `value`, `title`, `aria-label`, `href`, `src`, and form data;
- current URL, referrer, query, fragment, and UTM values;
- copied text and every unknown `$` property.

Do not mark workout inputs, free-text fields, exercise rows, history rows,
program content, generated recommendations, dialogs containing user data, or
setup/import surfaces for autocapture.

The implementation is acceptable if autocapture is temporarily disabled while
the allowlist is developed. It is not acceptable to enable broad autocapture
first and rely on a later cleanup.

### 7. Run replay at maximum privacy

The alpha target is 100% of eligible, opted-in sessions, subject to SDK load,
browser blocking, and PostHog availability. It is not a guarantee that every
session will produce a recording.

Configure replay with:

- `maskAllInputs: true`;
- `maskTextSelector: "*"`;
- no input/text unmasking in the first release;
- request and response header/body recording explicitly false;
- console recording false;
- canvas recording false unless separately reviewed;
- URL sanitization that retains only origin and pathname;
- `.ph-no-capture` on setup/import payloads, notes, history details, workout
  values, recommendation explanations, and other sensitive containers as a
  second layer.

Do not depend on CSS masking alone. The test suite must inspect outgoing replay
payloads or the SDK's pre-send record hooks and prove hostile strings do not
appear.

### 8. Scrub navigation data before the SDK sees it

Define one `safeLocation` representation containing only:

```json
{
  "origin": "https://taurifer.com",
  "pathname": "/"
}
```

Never include `search`, `hash`, `document.referrer` query/fragment, or a full
serialized `location`. Setup payloads live in URL fragments and therefore
make this a hard release boundary.

The application must not rewrite the actual browser URL merely to satisfy
analytics. Sanitize the values passed into or accepted from PostHog. The final
`before_send` guard rejects any event containing `#`, `?`, `%23`, `%3F`, known
setup prefixes, or URL-shaped property values outside the safe origin/path
fields.

### 9. Make opt-out real and immediate

Add a Settings row under a plain-language “Usage data” heading. Copy must say
that Taurifer sends pseudonymous usage events and masked session recordings to
PostHog, and that workout values and notes are excluded. Provide the same copy
in PT-BR and English.

Default is enabled. On disable:

1. persist Taurifer's preference;
2. call `posthog.opt_out_capturing()` if the SDK exists;
3. stop/pause session recording immediately;
4. clear any wrapper queue and SDK request queue available in the pinned API;
5. prevent SDK reload and all future captures for that boot;
6. leave product behavior unchanged.

On re-enable, call `opt_in_capturing`, restart only the explicitly configured
products, and continue with the same installation ID. Do not backfill events
from the opted-out period.

Test the setting before and after SDK load, offline, after reload, and while a
recording is active.

## Alpha measurement specification

Create `docs/measurement/alpha-scorecard.md` during implementation. It is an
operational specification, not another backlog. It must contain the exact
event schema version and the following definitions.

### Required funnels

| Funnel | Ordered steps | Main breakdown | Clock |
|---|---|---|---|
| Program activation | `app_boot` → `program_path_selected` → route-specific completion → `program_activated` | route, goal, frequency/family category | Same installation; 7 days from path selection |
| First gym-floor value | `program_activated` → `first_set_logged` → `session_completed` | route and family category | 14 days from activation |
| Recommendation understanding | `first_set_logged` → `recommendation_explained` → later `set_saved` | explanation surface; `vs_suggestion` | Within the active program; report events and unique installations |
| Session reliability | `first_set_logged` → `session_completed` or explicit `session_abandoned` | coarse stage/reason and duration bucket | One PostHog session plus Taurifer session correlation token that is random/ephemeral and not stable history |
| Repeated use | first completed session → another completed session | route and family category | D7, D30, and D60 rolling windows |

Do not add a stable workout ID to make a funnel easier. If the product cannot
distinguish one open Taurifer session without creating a reconstructable
history, use a per-active-session random token held only in memory and removed
from persisted/exported state; document the residual risk. Prefer PostHog's
own session scope where it answers the question.

### Scorecard hierarchy

The dashboard must keep four levels separate:

1. **Speed/reliability guardrail:** save latency measured locally in automated
   performance tests; session completion and explicit abandon rates in
   PostHog; support reports of loss.
2. **Progression trust mechanism:** explanation views, match/raise/lower/no-
   suggestion buckets, overrides, and interview evidence.
3. **Switching proof:** direct check-in asking whether the participant stopped
   consulting their old spreadsheet/notes. Telemetry cannot infer this.
4. **Retention outcome:** repeated completed sessions by eligible days since
   activation, reported with denominators and churn/interruption notes.

Every chart states:

- unit of analysis: event, session, or installation;
- inclusion/exclusion rules;
- numerator and denominator;
- observation window and timezone;
- schema/app versions included;
- whether the value is product telemetry, interview evidence, or operational
  evidence;
- minimum denominator before interpretation.

No conversion threshold or launch rule should be invented in this plan. The
founder reads rolling evidence as participants become eligible.

### Dashboard set

Create and export/version the definitions for:

- measurement health;
- entry route and program activation;
- first useful workout;
- session completion/abandonment;
- recommendation understanding/override;
- repeat training by D7/D30/D60 eligibility;
- opt-out rate and replay availability;
- schema/app version comparison.

Where PostHog does not provide a stable export format, store a manual build
recipe with insight type, filters, breakdowns, formula, and expected title.
Screenshots alone are not reproducible specifications.

### Measurement-health gates and alerts

Create a saved zero-tolerance query for each invariant below. Subscribe the
founder to the query where PostHog supports a reliable threshold alert;
otherwise put it in the daily alpha-read checklist:

| Health invariant | Threshold | Response |
|---|---:|---|
| Unknown custom event or wrong `telemetry_schema_version` | 1 event | Stop analysis and investigate the producing release before recruiting further. |
| Forbidden property/key or URL/query/fragment sentinel | 1 event | Treat as a privacy incident; disable affected automatic product/capture path immediately. |
| Person profile, identify/alias, `$set`, or group event | 1 event | Disable ingestion path and correct identity configuration. |
| Client ingestion/rate-limit warning | 1 warning | Find the loop/duplicate emission before interpreting event counts. |
| Product event missing app/schema/channel metadata | 1 event | Exclude affected release and repair the adapter. |
| Event from preview/test channel in production scorecard | 1 included event | Repair dashboard filters; do not blend test traffic with alpha evidence. |

Silence alerts need an eligible denominator because a rolling organic alpha can
legitimately have no traffic. Once at least three opted-in installations have
produced `app_boot` in the prior seven days:

- investigate 48 consecutive hours with no production `app_boot`;
- investigate 72 hours with boots but no other accepted product event;
- after at least 20 eligible opted-in sessions, investigate replay availability
  below 80%, while reporting blockers/SDK failures separately from opt-out;
- after each production deploy, perform a clean-install smoke within 30 minutes
  and confirm its event/replay in PostHog without leaving synthetic data inside
  the alpha dashboard filters.

These are measurement-pipeline health checks, not product-success thresholds.
Do not infer churn or product failure from a silence alert without checking the
rolling recruitment/eligibility context.

## Implementation sequence

### Slice 1 — pure boundary and tests

1. Add `telemetry.js` with schema, validators, scrubbing, buckets, identity,
   preference, and null adapter.
2. Add Node unit tests before migrating a single call site.
3. Add CI syntax/test invocation.
4. Prove unknown events/properties and hostile values are rejected.

### Slice 2 — pinned PostHog adapter

1. Pin one SDK version and verify proxy routes.
2. Replace init configuration with the explicit hardened configuration.
3. Bootstrap the Taurifer installation ID without creating a person profile.
4. Add the final `before_send` guard.
5. Keep all automatic products off until their leakage tests pass.

### Slice 3 — product-event migration

1. Replace/remove every direct capture call using the migration table.
2. Add `app_boot` only after boot/recovery has succeeded enough to define it.
3. Emit approved events at explicit product commits, not button impressions
   that can later fail.
4. Add an `rg` guard proving only the adapter references `window.posthog` and
   only `telemetry.js` declares event names.

### Slice 4 — privacy UI, autocapture, and replay

1. Add Settings disclosure/toggle and i18n.
2. Add deliberate `data-telemetry-action` annotations to the smallest useful
   static navigation set.
3. Enable controlled autocapture after its tests pass.
4. Add maximum-privacy replay configuration and sensitive-container markers.
5. Enable replay after its tests pass.

### Slice 5 — measurement operations

1. Write `docs/measurement/alpha-scorecard.md`.
2. Build the dashboards/insights in the production project.
3. Run clean-install, returning-install, opt-out, blocker, offline, and hostile
   setup-link smoke tests.
4. Record project-level settings and initial health baseline.

Do not merge a half-configured state in which broad automatic capture is live
before the schema and privacy gates.

## File-change map

| File | Required change |
|---|---|
| `telemetry.js` | New pure policy/schema/identity/facade module. |
| `posthog-init.js` | Narrow pinned SDK loader and adapter; no product schema. |
| `scripts/generate-posthog-config.mjs` | Generate exact version/config inputs and fail closed in non-production/invalid configurations. |
| `index.html` | Load telemetry before PostHog/app; add Settings UI and revisioned assets as needed. |
| `app.js` | Remove generic SDK passthrough; emit approved semantic events; wire preference. |
| `styles.css` | Accessible Settings treatment only. |
| `i18n/en.json`, `i18n/pt-BR.json` | Pseudonymous-use disclosure and controls. |
| `i18n.js` | Regenerate; never hand-edit. |
| `service-worker.js` | Cache new runtime file and bump cache/revision references. |
| `test/telemetry-unit.mjs` | Pure schema, identity, bucketing, URL, failure, and opt-out tests. |
| `test/telemetry.mjs` | Browser interception, SDK failure, replay/autocapture leakage, Settings, offline tests. |
| `test/run.mjs` / CI workflow | Run the new focused suite. |
| `docs/measurement/alpha-scorecard.md` | Versioned event/funnel/dashboard/health specification. |

## Test matrix

### Pure tests

- every catalogue event accepts its minimum valid shape;
- every unexpected property is rejected;
- nested values, arrays, IDs, raw numbers, URLs, hashes, free text, exercise
  names, and setup-like payloads are rejected;
- buckets are deterministic at every boundary;
- corrupt identity records are replaced safely;
- opt-out persists and emits nothing;
- SDK absence/throw/rejection never propagates;
- schema/adapter inputs are not mutated.

### Browser leakage tests

Seed conspicuous sentinel strings in:

- URL query and fragment;
- imported setup payload;
- program/day/exercise names;
- notes and free text;
- weight, reps, RIR, and bodyweight inputs;
- recommendation explanation;
- thrown error message and stack;
- console log/error;
- fetch URL, headers, request body, and response body;
- DOM text, title, aria label, href, and data attributes.

Capture outbound `/e/`, replay, flags, surveys, and static-extension requests.
Fail if any sentinel or encoded variant appears. Also fail if an unexpected
endpoint/product is contacted.

### Product behavior tests

- first run and returning boot with SDK loaded, blocked, slow, and throwing;
- online → offline → online around capture calls;
- opt out before load, after load, mid-recording, and after reload;
- opt in does not backfill opted-out actions;
- setup links and shared setup still import correctly while their fragments
  remain invisible to PostHog;
- workout save, finish, export, and recovery outputs are byte-for-byte
  independent of analytics availability;
- PT-BR/English copy and keyboard/screen-reader interaction;
- 320 px layout and light/dark screenshots.

### Production smoke tests

- one clean install yields one pseudonymous installation identity without a
  person profile;
- event payload contains only catalogue properties and expected SDK session
  metadata;
- replay shows useful geometry/interactions but masks all values/text;
- opt-out stops all ingestion immediately;
- blockers or proxy failure leave Taurifer fully usable;
- dashboards use the documented definitions and correct app/schema versions.

## Performance and offline budgets

- Telemetry module parse/evaluation must remain negligible relative to app
  boot and contain no dependency.
- Do not block first render or storage recovery on the PostHog script.
- Do not wait for an analytics promise before navigation or saving.
- Replay must not create visible workout input lag on the physical-device
  matrix. If it does, disable replay and investigate; do not weaken masking.
- Offline queues must obey opt-out and must not grow without a documented cap.

## Acceptance checklist

- [ ] No application code calls `window.posthog` outside the adapter.
- [ ] Every custom event/property is schema-validated and phase-gated.
- [ ] Existing unapproved events are removed.
- [ ] Installation identity is random, device-only, non-exported, and has no
      person profile.
- [ ] SDK version and all automatic product states are explicit.
- [ ] Query strings, fragments, setup payloads, free text, exact workout
      values, exercise identities, console, errors, and network payloads pass
      hostile-sentinel leakage tests.
- [ ] Replay masks all inputs and app text.
- [ ] Autocapture accepts only reviewed static actions.
- [ ] Settings clearly describes pseudonymous capture and offers a persistent
      off switch in PT-BR and English.
- [ ] Opt-out stops every enabled PostHog product and queued capture.
- [ ] Analytics failure cannot change any product result.
- [ ] Alpha funnels, clocks, denominators, dashboards, and health checks are
      versioned in `docs/measurement/alpha-scorecard.md`.
- [ ] Required light/dark screenshots and physical-device latency evidence are
      refreshed.

## STOP conditions

- STOP if `capture(event, arbitraryObject)` remains available to product code.
- STOP if a useful dashboard requires exact workout values, exercise IDs,
  program payloads, stable workout IDs, or free text.
- STOP if a URL/query/fragment, setup payload, console/error message, network
  payload, or DOM/input value reaches PostHog.
- STOP if remote project settings can silently re-enable an unreviewed product.
- STOP if replay/autocapture is enabled before hostile leakage tests pass.
- STOP if copy calls analytics anonymous.
- STOP if opt-out leaves replay, errors, surveys, automatic events, or queued
  events active.
- STOP if PostHog availability can delay or fail boot, logging, saving,
  recovery, export, or normal progression.
- STOP if free text is transmitted as part of this plan.
