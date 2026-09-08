# Install-transfer operations runbook

This runbook is an owner gate for the temporary install-transfer exception.
The service must remain create-disabled until the owner has a real EU
Durable-Object namespace, an independent watchdog, billing evidence, and a
redaction check. The local suite cannot supply those deployment facts.

Run the reproducible local checks from this directory:

```sh
npm ci
npm run check
npm test
npx wrangler deploy --dry-run
npx wrangler whoami
```

`whoami` must identify the owner account before any staging action. A dry run
only checks the local bundle and Wrangler configuration. Do not run a real
deploy from an unauthenticated checkout.

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

All three namespaces must be accessed through the EU subnamespace. The Worker
calls `namespace.jurisdiction("eu")`; the current local workerd limitation is
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

For a deletion incident, call `markDeletionUnhealthy` and set the kill switch
before investigating. Run `npm run ops:purge` with a bounded operation ID and
evidence reference; the registry enumerates due route metadata and invokes the
routed Durable Objects without requiring a user bearer or clone data. The
scheduled provider pass is the recovery backstop after the finite registry
retention window: it enumerates the fixed namespace and submits validated IDs
to `/_ops/purge-objects`, whose response contains counts only. Use
`npm run ops:ack` only after the current incident generation, both purge
results, and redaction review are checked and the explicit confirmation
variable is set. Never put a bearer, claim ID, object ID, or provider cursor in
a URL, command history, or log.

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
