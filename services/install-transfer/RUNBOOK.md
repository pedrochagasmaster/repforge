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
  rejects other namespaces and limits each page to 10–100 objects (defaulting to Cloudflare's minimum supported limit of 100 objects) and batches purge calls in chunks of at most 32 objects, with each
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
| Repeated cursor or repeated object ID | Source guards fail closed; deterministic committed coverage or an authenticated staging artifact remains open | `scripts/health-producer.mjs`, `test/health-producer.integration.mjs` |
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

## Production enablement (owner override, 2026-10-14)

On 2026-10-14 the owner enabled new creates for real users on
`https://taurifer.com` **without** recording the evidence for the open gates
above. This is an explicit owner override of this runbook's gate table and of
ADR 0013's staging and physical-device evidence gates. None of these gates is
closed by this section; each remains open owner evidence:

- authenticated EU placement of all four Durable Object namespaces;
- provider disposal and restored-SQLite review;
- independent billing, watchdog, log, and deletion health;
- minute-60 ciphertext and minute-75 tombstone deletion measured on Cloudflare,
  including the delayed-alarm and purge-backstop cases;
- physical iOS Safari 17.2+ to Home Screen handoff;
- the six provider-deadline items listed above.

### What runs in production

`wrangler.jsonc` `env.production` deploys a separate Worker,
`taurifer-install-transfer`, routed at `taurifer.com/v1/*` with no
`workers.dev` or preview URL. The client already calls the page's own origin,
so the app needs no change. The Worker has its own SQLite Durable Object
namespaces, created by the `v1` migration on first deploy and always reached
through `jurisdiction("eu")`. Production never sets `TRANSFER_LOCAL_TEST_EU`,
so if the EU subnamespace is unavailable the Worker fails closed instead of
falling back. Its vars are `TRANSFER_ALLOWED_ORIGIN=https://taurifer.com`,
`TRANSFER_CREATES_ENABLED=true`, `TRANSFER_KILL_SWITCH=false`,
`TRANSFER_TOKEN_MAC_KEY_ID=k1`, and the five static health labels set to
`healthy`. `test/install-transfer-production-config.mjs` pins all of this, so
config drift fails CI. The staging Worker
(`taurifer-install-transfer-staging`) and its preview origin are unchanged.

The service worker in `sw.js` leaves every same-origin `/v1/` request to the
network; `test/sw-transfer-passthrough.mjs` proves it. The repository has no
Pages `_routes.json`, `_redirects`, or `_headers` that could answer `/v1/*`.
Cloudflare documents that a zone Worker route runs before the hostname's
origin and takes precedence over a custom domain on the same hostname. The
authoritative check is the live probe after deploy: before the route existed,
`OPTIONS https://taurifer.com/v1/transfers` returned Pages' `405`.

### Secrets

`node scripts/provision-production-secrets.mjs worker` generates each value
from `node:crypto` and pipes one JSON object to
`wrangler secret bulk --env production` on stdin. Nothing is printed, logged,
or passed in argv. Every value is 32 random bytes encoded as 43 unpadded
base64url characters.

| Secret | Format | Kept on the devbox |
|---|---|---|
| `TRANSFER_ROUTING_KEY_B64` | base64url, ≥32 decoded bytes (43 chars) | Never |
| `TRANSFER_TOKEN_MAC_KEY_B64` | base64url, ≥32 decoded bytes (43 chars); id `k1` is a var | Never |
| `TRANSFER_DIGEST_KEY_B64` | base64url, ≥32 decoded bytes (43 chars) | Never |
| `TRANSFER_RATE_PEPPER_B64` | base64url, ≥32 decoded bytes (43 chars) | Never |
| `TRANSFER_WATCHDOG_SECRET` | 32–256 chars bearer (43 generated) | `production-ops.env` |
| `TRANSFER_BILLING_SECRET` | 32–256 chars bearer (43 generated) | `production-ops.env` |
| `TRANSFER_PURGE_SECRET` | 32–256 chars bearer (43 generated) | `production-ops.env` |
| `TRANSFER_ACK_SECRET` | 32–256 chars bearer (43 generated) | `production-ops.env` |

`TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID` and `TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64`
are optional and only used during a MAC-key rotation; production starts
without them. The devbox file `~/.config/taurifer/production-ops.env` holds
only the four ops secrets plus non-secret values: the service URL, account
ID, the production `TransferDurableObject` namespace ID, the attested monthly
cost (default `0`), and `TRANSFER_CF_API_TOKEN`. The directory must be 0700
and the file 0600. The provisioning script and the health loop both refuse to
run if either is looser. A second `worker` run refuses rather than rotating
live keys.

`TRANSFER_CF_API_TOKEN` must be a separately scoped token that can list
objects in the Durable Object namespace. It must never be the deploy token.
The owner mints it and pipes it in with
`node scripts/provision-production-secrets.mjs api-token`, which reads stdin
and rejects a value equal to `CLOUDFLARE_API_TOKEN`. Until then the file holds
a placeholder and the health loop refuses to run, so creates stay at 503.

### The health lease is owner self-attestation

Creates need more than `TRANSFER_CREATES_ENABLED=true`. The health Durable
Object must also hold five heartbeats less than five minutes old, a deletion
pass, and a billing receipt less than 24 hours old, below 1,000 cents. The
Worker has no cron trigger. Staging got its lease from a devbox loop that
stamped "pass" receipts with the current time every two minutes. That loop
last ran on 2026-09-11, so staging creates have returned 503 since then.

Production does the same thing explicitly with
`node scripts/production-health-loop.mjs`, one pass per run. Each pass:

1. writes five `owner-watchdog` receipts and one `owner-billing-receipt`, all
   with `checkVersion` `operator-attested-v1`, `evidenceRef`
   `owner-override-20261014`, and the current time;
2. runs `scripts/health-producer.mjs`, which still performs the real registry
   purge, enumerates the namespace through the provider API, purges due
   objects, and fails closed on any error.

These receipts are the owner's attestation, not independent monitoring. The
billing amount is attested, not observed. The loop's output is limited to
purge counts, exit codes, and the producer's fixed error text.

Run it from a dedicated checkout of the deployed SHA at `~/taurifer-transfer-production` (a detached worktree, not a `/tmp` one; the unit's `WorkingDirectory` points there). The unit pins `NODE` to an absolute Node 22 binary because systemd user units don't load nvm; change it with `systemctl --user edit taurifer-transfer-health.service`. Run it
as a systemd **user** service of type `oneshot` (90-second start timeout,
`UMask=0077`), triggered by a user timer every two minutes, starting one
minute after boot. User lingering keeps the timer running across logouts and
reboots. On the devbox `loginctl show-user ubuntu -p Linger` reported
`Linger=yes` on 2026-10-14; if it reads `no`, run
`sudo loginctl enable-linger ubuntu`.

Check it with `systemctl --user list-timers` (next and last run),
`systemctl --user status taurifer-transfer-health.service` (last exit), and
`journalctl --user -u taurifer-transfer-health.service -n 20` (last summaries). Stop it with
`systemctl --user disable --now taurifer-transfer-health.timer`.

**Failure behaviour:** when the timer stops, the devbox is down, or a pass
fails, the lease lapses within five minutes and every new create returns
generic `503 {"state":"unavailable"}`. Claims, status, commit, and the
private purge routes do not use the lease and keep working, so an
already-created transfer can still be installed. While the loop is stopped,
the scheduled provider purge backstop does not run either. Deletion then
relies on the Durable Object alarms.

### Monitoring that exists

- The health-loop journal on the devbox (exit status and purge counts).
- `GET /_ops/health` with the watchdog bearer, which returns the lease and
  incident state. It is private and has no public health route.
- Cloudflare's dashboard for the Worker (requests, errors, Durable Object
  usage) and the account's billing page.

No alerting is configured, and no independent watchdog observes the service.
The gates above stay open until the owner records that evidence.

### Turning creates off

Any of these works, from the fastest:

1. `npx wrangler deploy --env production --var TRANSFER_KILL_SWITCH:true --tag kill-switch --message "Kill switch"`
   from the deployed checkout. It takes effect on deploy, and secrets are kept.
2. The same with `--var TRANSFER_CREATES_ENABLED:false`, or a reviewed config
   change that sets either var in `env.production`.
3. Stop the health timer (`systemctl --user disable --now taurifer-transfer-health.timer`). Creates
   fail within five minutes.

A later deploy without `--var` restores the checked-in values, so record a
kill in the config if it must persist. Claims, status, commit, and purge stay
available in every case.
