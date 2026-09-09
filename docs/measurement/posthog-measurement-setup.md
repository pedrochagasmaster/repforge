# PostHog measurement setup

Status: repository tooling and operator procedure; not evidence that live
PostHog configuration or physical-device validation has been completed.

## Private attribution roster

Keep a private JSON configuration outside this repository. For each browser,
installed PWA, and testing device, establish its current anonymous installation
ID during a controlled smoke window. Record the device/browser label, exact
window, and confirmation evidence in a separate private roster log. A UUID
identifies a browser installation, not a person; clearing storage can rotate it.
Do not merge identities based on geography, screen size, or an iPhone guess.

For an installation under the operator's control, its existing ID is available
locally; this read does not capture or transmit anything:

```js
JSON.parse(localStorage.getItem('repforge_telemetry_identity_v1') || 'null')?.installationId
```

Where developer tools are unavailable, make a timestamped, unique synthetic
journey and privately correlate the explicit events. Do not classify the ID
until ownership is verified. Never restore person profiles, call `identify`,
add a fingerprint, or change the telemetry schema for this attribution work.
Do not send the roster or local storage contents to telemetry.

Use three categories: confirmed internal/test, confirmed independent pilot,
and unclassified. Previously inferred founder candidates stay unclassified
until confirmed. The existing person-property-based internal cohort is not a
substitute for this roster. An empty independent roster means **no validated
independent sample**, not all traffic except the founder.

The compiler accepts these fields only:

```json
{
  "projectId": 1,
  "timezone": "UTC",
  "from": "2020-01-01T00:00:00Z",
  "asOf": "2020-04-01T00:00:00Z",
  "appVersions": ["release-a"],
  "internalInstallationIds": [],
  "pilotInstallationIds": []
}
```

These are illustrative values, not a production config. Set the actual project,
verified UTC timezone, schema-compatible app-version range, and observation
window. The end is exclusive. Include the earliest witnessed first-run boot
needed by the cohort; missing early releases or a truncated range can exclude
otherwise valid installations. Rosters contain IDs only, never emails or names.

## Generate and migrate

Run Node 22 from the repository root, supplying external paths:

```sh
node tools/build-posthog-measurement.mjs "$HOME/taurifer-measurement.json" "$HOME/taurifer-measurement-plan.private.json"
node --test test/posthog-measurement.mjs
```

The compiler reads the actual `telemetry.js` event taxonomy and duplicate
policies, validates the configuration, and exclusively creates a mode-0600
output file. It refuses in-repository paths, overwrites, and output symlinks.
The output contains installation IDs in query predicates: keep it private,
including when reviewing a diff between roster revisions. No credentials,
network requests, PostHog writes, or runtime/PWA changes are involved.

1. In the intended PostHog project, confirm the project ID and timezone against
   the generated manifest. Export or privately record the existing dashboard
   and insight IDs before migration; keep their historical data intact.
2. Use the manifest's `dashboard` object to create a dedicated schema-1 dashboard
   via PostHog's dashboard API or UI. Record its ID in the private build log.
   Do not copy the old dashboard's global property, bot, or test-account filters.
3. Each `insights[].payload` is a saved-insight definition. Create it with
   `dashboards: [newDashboardId]`, or update the previously recorded managed
   insight ID on subsequent runs. Match both the recipe tag and recorded ID;
   do not create duplicates or overwrite unrelated insights by title alone.
   Preserve existing unrelated dashboard memberships when updating an insight.
4. Execute every definition in PostHog, not just its metadata endpoint. SQL
   tiles are fixed-window tables; dashboard date overrides do not move their
   boundaries. Regenerate with a new `asOf` for each reading and record it.
   Add the manual diagnostic funnels from the dashboard recipes separately.
5. Reconcile raw schema-1 event counts against attribution coverage. Confirm a
   known internal trace appears only in internal diagnostics, a verified pilot
   appears in pilot metrics, and unknown visitors remain unclassified. With an
   empty pilot roster, validation metrics must remain empty/null. Test a
   deliberately malformed synthetic event in a non-production fixture: health
   must show it rather than filtering it away.
6. Mark the superseded dashboards as **Legacy — pre-schema-1; not for alpha
   validation** after parity and privacy checks. Do not delete history or
   silently reinterpret its identities. Record the migration and reviewer.
7. Complete the Android/iOS physical-device smoke in the operations runbook.
   Query syntax or local adapter-stub tests cannot establish production capture.

API references: [saved insights](https://posthog.com/docs/api/insights),
[dashboards](https://posthog.com/docs/api/dashboards), and
[queries](https://posthog.com/docs/api/query). Use a least-privilege personal
API key only in the operator environment, never in this configuration, the
browser, the generated file, CI artifacts, or GitHub. Live application of these
definitions is a separate reviewed operator action, not part of generating them.

## Interpretation gates

A witnessed `first_run=true` boot is an observation filter, not proof of a
first-ever installation or person. Confirm recruitment/history in the private
roster; resets and missing early events can change eligibility. Label the
compiled cohort as **first-run-observed**, not all new or returning users.

The compiled new-installation first-value and repeat views are deliberately
restricted to witnessed first-run boots. Report excluded/incomplete-history
installations separately; do not label them failures or compare these rates
with historical all-activation denominators. Inspect duplicate/conflicting
terminals before interpreting session outcomes. SDK sessions can split on reload
or span more than one workout; telemetry cannot reconstruct workout records.

Historical rage clicks, a generic Safari error, and sparse LCP measurements
are investigation leads, not reproduced defects or a platform benchmark. Check
Cancel/back navigation and a complete saving journey on current physical Safari
and Android. Record a specific reproduction before changing product behavior.
No cohort size in this tooling establishes a new product-success threshold.
