# #529 live privacy and identity: findings and recommendations for the owner (2026-10-29)

Read-only. Nothing in this note was applied to PostHog, Cloudflare, consent
defaults, replay settings or the app. Each recommendation is an owner decision.
The sources are the repository at `main` 3f3292f9, the read-only project
inspection already recorded in
[`measurement-operations.md`](measurement-operations.md#live-verification--2026-10-28-529),
#529's audit snapshot, and the published `posthog-js@1.400.0` bundle (the SDK
version `posthog-init.js` pins). I had no live PostHog query access, so every
claim about stored data is marked as such.

## 1. Person profiles: a probable code-level cause (highest priority)

**Finding.** #529 counted 16 `persons` rows, including 2 created after the
latest deployment, despite `person_profiles: "never"` and no identify, alias,
group or `$set` path in the app. The configuration is right, but the app's
own privacy filter removes the flag that carries it:

- With `person_profiles: "never"`, the pinned SDK sets
  `properties.$process_person_profile = false` on each event while computing
  its properties. Before sending, it then runs the configured `before_send`.
  Verified in the 1.400.0 bundle: `a.$process_person_profile=g` in
  `_calculate_event_properties`, and `before_send` applied afterwards in
  `capture`.
- Taurifer's `before_send` (`telemetry.js` `filterOutbound`,
  `filterAutocapture` and `filterReplay`) rebuilds `properties` from a closed
  allowlist: event properties, schema/app/channel, `token`, `distinct_id`,
  `$session_id`, `$window_id`. `$process_person_profile` isn't on it, so
  **every product event, allowlisted autocapture and replay snapshot leaves
  without it**.
- PostHog's ingestion treats an event without `$process_person_profile: false`
  as person-processing, which creates or updates a person for the
  `distinct_id`. That would explain persons appearing for pseudonymous
  installation IDs, including new ones after the latest deploy. Before calling
  it the cause, it needs a controlled ingestion check (below).

**Recommendation.** It's a one-line code change: in each of the three filters,
add `$process_person_profile: false` as a constant, not a pass-through, so the
allowlist stays closed. Prove it with a unit assertion on the outbound
envelope and with one controlled production event that creates no person.
Separately, deciding what to do with the 16 existing person rows (keep as
historical, or delete through PostHog) is an owner data decision. The privacy
runbook's response applies if they are treated as a collection violation.

## 2. IP address and geolocation at rest

**Finding.** The client never sends `$ip`: it isn't on any allowlist, and
`get_current_url` is origin plus path only. But ingestion derives the IP from
the request itself. `e.taurifer.com` is a DNS-only CNAME to PostHog's managed
proxy, so PostHog sees the client's address, and the project has
`anonymize_ips: false`. #529 observed `$ip` and `$geoip_city_name` on all
1,025 events. A client-side filter can't remove ingestion enrichment.

**Recommendation.** If the approved minimization policy excludes IP and city
(the runbook's "no extra metadata" intent suggests it does), turn on the
project's **Discard client IP data** (`anonymize_ips: true`). PostHog's
GeoIP enrichment then has no address to resolve. This is a live setting, so
it's an owner action. Historical events keep their stored values; deleting
them is a separate data decision.

## 3. Project settings that drift from the runbook

From the 2026-10-28 inspection: `autocapture_web_vitals_opt_in`,
`capture_performance_opt_in` and `capture_console_log_opt_in` are `true`
where the runbook requires them off. The client disables all three
(`capture_performance: false`, `logs.captureConsoleLogs: false`, and no
web-vitals path), but remote config can change SDK behaviour, so the
runbook treats project state as a release gate.

**Recommendation.** Set the three to off, to match
`measurement-operations.md`. Record the change in that file's live
verification table. Owner action.

## 4. Consent default versus published copy

**Finding.** The ratified policy is default-on with a plain-language
disclosure and a persistent off switch (Plan 045, decision 7). The code
matches it: a missing `repforge_telemetry_enabled_v1` reads as enabled. The
landing FAQ says so too ("that option starts switched on"). But the Privacy
page (`privacy.telemetry.body`, EN and PT) says **"Telemetry is opt-in"** and
describes **"a stable anonymous identity"**. Both are inaccurate: it's
default-on, and the ID is a pseudonymous installation ID, as Settings says.

**Recommendation.** Keep the default; it's the ratified policy, and changing
it is out of scope here. Correct the Privacy page copy in both languages to
say telemetry is on by default with an off switch in Settings, and to call
the identity a "pseudonymous installation ID". The PT copy needs your review
(#315 process).

## 5. Replay and autocapture: still unverified in practice

The client side is strict. Replay uses `maskAllInputs`, `maskTextSelector: "*"`,
`mask_all_text`, `mask_all_element_attributes`, the `.ph-no-capture` block,
no canvas or cross-origin frames, no headers or bodies, network names reduced
to origin plus path, and a `filterReplay` that drops any snapshot with
unmasked text or setup-link fragments. Autocapture is limited to `click` on
`button` elements carrying `data-telemetry-action`, and `filterAutocapture`
reduces each one to its action name. #529 still saw zero `$autocapture` and
`$snapshot` events in the window, and the audit had no `session_recording:read`.
Project-level `session_recording_sample_rate` and network-payload config read
as `null`, which doesn't prove the intended values.

**Recommendation.** One controlled, opted-in production session on a
synthetic installation: tap one allowlisted action, then verify the
`$autocapture` event carries only `telemetry_action`. Open the recording and
check masking and the blocked regions. Opt out mid-session and confirm the
recording stops and nothing more is sent. Set the sample rate explicitly to
the runbook's 100% of eligible sessions, and set network payload capture to
off. This needs replay-read access, which belongs to the owner.

## Suggested order

1. Approve the `$process_person_profile` code fix (§1). It's the only item
   that keeps creating data, and it can ship as a normal PR.
2. Owner settings session: discard client IP data (§2) and the three
   runbook toggles (§3). Record both in `measurement-operations.md`.
3. Privacy-page copy correction (§4).
4. The controlled production session (§5), using the existing smoke matrix
   in `measurement-operations.md`. This also confirms §1's fix creates no
   person.
5. Decide what happens to existing person rows and stored IP/geo values.
