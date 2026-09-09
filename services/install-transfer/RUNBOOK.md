# Install-transfer operations runbook

This runbook is an owner gate for the temporary install-transfer exception.
The service must remain create-disabled until the owner has a real EU
Durable-Object namespace, an independent watchdog, billing evidence, and a
redaction check. The local suite cannot supply those deployment facts.

## Packet boundary and current local evidence

This reconciliation is limited to the two service documents and is based on
accepted PR235 head `5074c4eefc389d45adc93c4c2f6d133b01ee3f22`. S53-01 changed
only the claim-response transport boundary: the logical envelope and create
body remain `2,000,000` UTF-8 bytes, claim/commit/status request bodies remain
`4,096` bytes, and the claim response is bounded at `2,004,096` bytes. The
claim-response parser rejects one byte over its bound as `response-too-large`;
the Worker fails closed with generic `503 {"state":"unavailable"}`. No
logical payload or wire field was widened.

Run the reproducible local checks from this directory:

```sh
npm ci
npm run check
npm test
npm run deploy:dry
npx wrangler whoami
```

`whoami` must identify the owner account before any staging action. A dry run
only checks the local bundle and Wrangler configuration. Do not run a real
deploy from an unauthenticated checkout. At this checkpoint `npx wrangler
whoami` reported that this environment is not authenticated; no temporary
account or deployment was used.

Observed at the accepted head:

| Exact command | Local result | What it does not prove |
|---|---|---|
| `npm test` | 14 Vitest files, 65 tests passed; health-producer integration passed | Authenticated provider behavior or retention deadlines |
| `npm run check` | 14 service source files, 5 scripts, and Wrangler configuration checked | EU placement or live bindings |
| `npm run deploy:dry` | 162.20 KiB upload / 31.87 KiB gzip; four Durable Object bindings; dry-run only | A deployed Worker, billing, logs, alarms, or purge |
| `node test/install-transfer-limits.mjs` (repo root) | Independent boundary, hostile-input, redaction, and Node/browser parity checks passed | Service parity; the test intentionally records that limitation |
| `node test/install-transfer-client-contract.mjs` (repo root) | 9 passed, including the S53-01 claim-response boundary and `+1` rejection | App/storage import, real iOS, or staging |

The health-producer integration is part of `npm test`; it currently proves a
complete mock-provider pass and rejects a full page that ends without a cursor.
The source scheduler also contains fail-closed guards for repeated cursors and
repeated object IDs, but deterministic committed coverage for those cases or
an authenticated staging artifact remains open. No ephemeral probe output is
treated as durable evidence.

The staging deployment needs these non-secret settings and bindings:

- `TRANSFER_ALLOWED_ORIGIN` — the one HTTPS Taurifer origin, or localhost for
  a local-only deployment;
- `TRANSFER_CREATES_ENABLED` — `false` until every gate below is proved, then
  explicitly `true` by the owner;
- `TRANSFER_KILL_SWITCH` — `true` during setup and incident response;
- `TRANSFER_ALARM_HEALTH`, `TRANSFER_WATCHDOG_HEALTH`,
  `TRANSFER_LOG_HEALTH`, `TRANSFER_KEY_HEALTH`, and
  `TRANSFER_DELETION_HEALTH` — static configuration checks that must all be
  `healthy`, in addition to the fresh health-object evidence;
- `TRANSFER_OBJECTS`, `RATE_LIMIT_BUCKETS`, and `TRANSFER_HEALTH` — bindings
  for the SQLite Durable Object classes, plus `TRANSFER_REGISTRY` for bounded
  route reservation and purge enumeration;
- `TRANSFER_ROUTING_KEY_B64`, `TRANSFER_TOKEN_MAC_KEY_B64`,
  `TRANSFER_TOKEN_MAC_KEY_ID`, `TRANSFER_DIGEST_KEY_B64`, and
  `TRANSFER_RATE_PEPPER_B64` — secret names only. Values stay in the provider
  secret store and must never be printed or placed in logs.
- `TRANSFER_WATCHDOG_SECRET`, `TRANSFER_BILLING_SECRET`,
  `TRANSFER_PURGE_SECRET`, and `TRANSFER_ACK_SECRET` — separate private ops
  credentials. Values stay in the provider secret store.
- `TRANSFER_CF_API_TOKEN` — a scoped token that can enumerate only the fixed
  Durable Object namespace. Keep it in the scheduler's secret store and never
  print it.
- `TRANSFER_CF_ACCOUNT_ID` and `TRANSFER_DO_NAMESPACE_ID` — the fixed account
  and transfer namespace used by the provider enumeration. The scheduler
  rejects other namespaces and limits each page to 10–32 objects and each
  complete pass to at most 288 objects (nine 32-ID purge batches plus the
  registry purge within the private purge-role rate window).

All four namespaces (transfer, rate-limit, health, and route registry) must be
accessed through the EU subnamespace. The Worker calls
`namespace.jurisdiction("eu")`; the current local workerd limitation is
documented in the README and is not staging evidence.

The global health object is the create admission lease. The scheduled
`npm run ops:health` producer first runs the bounded registry purge, then calls
Cloudflare's documented Durable Object namespace enumeration endpoint and
sends each in-memory page to the private `/_ops/purge-objects` route. It also
runs `scripts/provider-watchdog-probe.mjs` against the configured bounded
watchdog receipt, then posts the five health checks to `/_ops/heartbeat` and the
current owner billing receipt to `/_ops/billing`. A billing API integration is
not claimed. The producer fails closed on provider errors, ambiguous
pagination, repeated IDs/cursors, a partial purge, stale/future receipts, or
the configured work limit; it does not submit positive health after such a
failure. The heartbeat lease is five minutes; billing evidence is 24 hours. A
monthly observation of 1,000 cents or more fails new creates, even though
claims, status, commit, and purge remain available during the approved small
overrun. Static healthy labels without those fresh observations do not enable
creates.

The enumeration contract is Cloudflare's [Durable Object namespace objects
API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/subresources/objects/methods/list/).
The scheduler uses the configured account and namespace only, keeps cursors in
memory for one pass, and does not retain or log provider object IDs.

### Local negative-result ledger

The following are the expected negative results at this head. They are
reproduced by the named local assertions; none is a claim that the
authenticated provider gate has passed.

| Fault injected | Expected result | Existing assertion/evidence |
|---|---|---|
| Missing or stale health lease | `createsEnabled: false`; a static label cannot substitute for a fresh lease | `health-do.test.js` — `requires fresh watchdog evidence and a current billing observation`; `operations.test.js` |
| Failed deletion health | The incident stays latched and creates remain disabled until current-generation acknowledgement; recovery routes remain available | `health-do.test.js` — `keeps a deletion incident latched...`; `ops.test.js` — `latches later service deletion failures...` |
| Billing at or above 1,000 cents, or stale billing evidence | New creates are disabled; billing threshold is not a hard cap and does not remove recovery paths | `health-do.test.js` threshold/age assertions; `observation.test.js` |
| Kill switch or invalid/missing static health/configuration | New creates are disabled and the public transfer response is generic `503 {"state":"unavailable"}` | `operations.test.js`; `http.test.js` — `requires the exact configured origin...` |
| Full page without cursor | Committed scheduler integration rejects the ambiguous page before positive health is posted | `health-producer.integration.mjs` |
| Repeated cursor or repeated object ID | Source guards fail closed; deterministic committed coverage or an authenticated staging artifact remains open | `scripts/health-producer.mjs`; no accepted repeated-pagination artifact yet |
| Missed alarm, corrupt metadata, or disposal acknowledgement failure | Local alarm/purge path quarantines or retries and latches deletion health; it never treats a failed disposal as success | `transfer-do.test.js` — alarm corruption, disposal failure, ambiguous disposal; `registry-do.test.js` |
| Tampered ciphertext/AAD or invalid bearer | Decryption/authentication fails closed; HTTP uses the generic `404 {"state":"unavailable"}` and MAC rejection allocates no rate/object state | `crypto.test.js`, `routing.test.js`, `transfer-do.test.js`, `http.test.js` |
| Creates disabled while an existing transfer is recoverable | Create is generic `503`, while claim/status/commit and private purge remain reachable for recovery | `http.test.js` — `routes create, duplicate, claim, commit, and status...`; `ops.test.js` purge assertions |
| Bearer, claim ID, clone, ciphertext, cookie, or full URL in observable output | Redaction output contains only its allowlisted shape; transport uses request bodies and no token URL; stored records omit plaintext | `node test/install-transfer-limits.mjs`; `node test/install-transfer-client-contract.mjs`; `client-http.test.js`, `crypto.test.js`, `transfer-do.test.js` |

The leakage row is a local canary result, not a provider-log review. The
redaction fixture has six cases across five unique channel values:
`service-structured-log`, `static-host-access-log`,
`client-response-observable`, `telemetry`, and `error-tracking`. The local
service/client tests add storage, URL, cookie, and marker assertions without
printing the canaries.

For a deletion incident, submit a failed deletion heartbeat through the
authenticated watchdog path (the scheduler does this when purge or provider
enumeration fails) and set the kill switch before investigating. Run
`npm run ops:purge` with a bounded operation ID and evidence reference; the
registry enumerates due route metadata and invokes the routed Durable Objects
without requiring a user bearer or clone data. The scheduled provider pass is
the recovery backstop after the finite registry retention window: it enumerates
the fixed namespace and submits validated IDs to `/_ops/purge-objects`, whose
response contains counts only. Use `npm run ops:ack` only after the current
incident generation, both purge results, and redaction review are checked and
the explicit confirmation variable is set. Never put a bearer, claim ID,
object ID, or provider cursor in a URL, command history, or log.

## Open owner and environment gates

Local workerd/SQLite tests and `deploy:dry` are useful contract evidence, but
they cannot close any authenticated provider or device gate. The status is:

| Gate | Local/dry result | Still required before an owner can enable creates |
|---|---|---|
| Authenticated EU placement | `namespaces.test.js` proves the deployed path fails closed when EU jurisdiction is unavailable; local workerd uses the explicit test fallback | Owner-run staging request showing all four Durable Object namespaces and SQLite processing in the approved EU subnamespace |
| Provider disposal and restored SQLite | Local alarms, registry purge, corrupt-record quarantine, disposal failure, and retry paths pass | Provider-backed missed-alarm/manual-purge rehearsal plus restored SQLite image review showing no persisted bearer, token-derived key, or decryptable clone |
| Billing, watchdog, log, and deletion health | Fresh leases, threshold, stale/future receipts, static flags, latching, and redaction assertions pass locally | Authenticated owner billing receipt, independent watchdog lag/kill observation, static-host/edge/Worker log review, and deletion-health evidence |
| Minute 60 and minute 75 | Fake-clock tests model ciphertext expiry and tombstone margin | Staging measurements showing ciphertext gone by minute 60 and tombstone gone by minute 75, including delayed-alarm and purge-backstop cases |
| Physical iOS handoff | No emulator or Chromium run is evidence for this gate | Owner-provided Safari 17.2+ to Home Screen PWA evidence for cookie handoff, storage separation, atomic import, recovery snapshot, and divergence warning |

No operator task in this table is complete. The owner must record the
authenticated evidence and the re-enable acknowledgement; this packet neither
provisions credentials nor performs those actions.

The provider deadline gate is still open until staging evidence shows:

1. ciphertext deletion at or before server minute 60 under normal expiry and
   delayed alarm conditions;
2. tombstone deletion by minute 75;
3. watchdog detection and create kill within the agreed bounded lag;
4. manual purge after a missed alarm, including a restored SQLite image review
   that confirms no token-derived key or full token was persisted;
5. Cloudflare edge and Worker logs with request bodies, cookies, bearer tokens,
   claim IDs, ciphertext, clone fields, and full URLs redacted; and
6. the provider account's actual EU Durable Object placement and billing
   observation.

Until those checks are recorded by the owner, there is no public health route
and the create endpoint must stay at the generic 503 unavailable response.
This local branch has no staging credentials and makes no deployment or live-
SLA claim.
