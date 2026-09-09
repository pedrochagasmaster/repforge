# Install-transfer service

This directory is the isolated Plan 053 service. It has its own Wrangler
configuration, lockfile, and test dependencies; the root static app does not
depend on it.

## Evidence status at the accepted S53-01 head

This documentation is reconciled against `5074c4eefc389d45adc93c4c2f6d133b01ee3f22`,
the accepted PR235 head. S53-01 corrected the claim-response boundary without
changing the logical clone contract:

- the create request and logical envelope remain limited to `2,000,000` UTF-8
  bytes;
- claim, commit, and status request bodies remain limited to `4,096` bytes; and
- a claim response has its own `2,004,096`-byte bound (`2,000,000` bytes for
  the envelope plus the approved small-response headroom), with one byte over
  that bound rejected as `response-too-large`.

The client parser and Worker use that explicit claim-response mode. The Worker
returns the generic `503 {"state":"unavailable"}` if it cannot emit a bounded
claim response. This is a transport boundary correction, not a new envelope
field or a larger logical payload.

The bearer format is:

```text
v1.<keyId>.<route>.<random>.<mac>
```

`keyId` is 1–16 ASCII URL-safe characters. `route`, `random`, and `mac` are
each exactly 32 bytes encoded as 43 unpadded base64url characters. `route` is
an HMAC-SHA-256 of the create idempotency key under a stable routing key.
`random` is 32 fresh random bytes. `mac` is an HMAC-SHA-256 over the protocol
version, key ID, route, and random components. The service uses the route only
to select one Durable Object; it verifies the MAC and keyed full-token digest
before reading state. It never stores the bearer or the derived AEAD key.

Each create idempotency key maps to one object. The object stores a keyed
idempotency digest, keyed token digest, encrypted envelope record, expiry, and
state. The record's AES-GCM associated data authenticates the protocol,
metadata schema, Durable Object transfer ID, creation time, and expiry. It
does not store raw idempotency keys, claim IDs, bearer strings, or plaintext
clone data. A committed tombstone clears the ciphertext, associated data, and
claim digest but retains only the keyed token digest, terminal state, and
original expiry until the 15-minute tombstone margin.

`crypto.js`, `routing.js`, and `lifetime.js` are pure primitives. The
`TransferDurableObject` class uses SQLite storage and a constructor migration,
then schedules one alarm for live expiry or tombstone purge. Every state
operation also checks its absolute server time, so a delayed alarm cannot make
an expired record claimable or committable. `transfer-do.test.js` runs against
the local Workers runtime and SQLite Durable Object binding; it does not fake
the storage layer.

Run the foundation checks from this directory:

```sh
npm ci
npm run check
npm test
npm run deploy:dry
```

At this accepted head the commands report 14 Vitest files and 65 passing
service tests, followed by a passing health-producer integration; the source
check reports 14 service files, 5 scripts, and the Wrangler configuration; and
the dry bundle reports 162.20 KiB uncompressed / 31.87 KiB gzip with four
Durable Object bindings. These are local or dry-run results, not deployment or
retention evidence.

From the repository root, the two required shared/client checks are:

```sh
node test/install-transfer-limits.mjs
node test/install-transfer-client-contract.mjs
```

The first passes its independent boundary, hostile-input, redaction, and
Node/browser parity checks (and deliberately does not claim service parity).
The second passes 9/9 client-contract assertions, including the S53-01
near-maximum claim response and `+1` rejection. No check-in test was changed
for this documentation packet.

Claim and commit transitions use conditional SQLite updates keyed by the
expected state, token digest, and expiry. The local Workers runtime tests
exercise concurrent creates, first-claim binding, same-claim retries, and
idempotent concurrent commits, as well as metadata and AAD tamper rejection.
The registry enumerates only bounded route metadata for its own purge job; the
authenticated `POST /_ops/purge-due` route invokes that job without a bearer,
claim ID, or clone field. A separate private `POST /_ops/purge-objects` route
accepts one bounded batch of validated Durable Object IDs and routes every ID
through the fixed EU `TRANSFER_OBJECTS` namespace. It returns only examined,
purged, deferred, and failed counts; it never returns IDs, routes, or cursors.
The provider scheduler enumerates the configured namespace through Cloudflare's
documented API, follows bounded cursor pages in memory, and submits those
batches. A missing cursor on a full page, repeated object/cursor, provider
error, or configured work limit failure is incomplete evidence and latches
deletion health. Registry rows are retained only through their finite recovery
window; provider enumeration is the independent recovery path after a row is
removed.

`GET /_ops/health` is private to the watchdog and acknowledgement roles. The
other private routes are `POST /_ops/heartbeat`, `/_ops/billing`,
`/_ops/deletion-ack`, `/_ops/purge-due`, and `/_ops/purge-objects`; each has a
separate bearer secret, bounded JSON, fixed-window operator rate limit, and
generic unavailable errors. A corrupt active record is deleted by its
singleton key, its object re-arms a short bounded alarm, and the global health
object disables new creates. Creates remain disabled unless configuration,
deletion, alarm, watchdog, key, log, billing, and fresh health-lease evidence
are all healthy and the operator enables them; the kill switch forces them off.
Claims, status, commit, and purge do not use this create gate.

The Worker consumes the accepted root `install-transfer-contract.js` module for
bounded raw parsing, endpoint validation, envelope integrity, and redaction
rules. It exposes `POST /v1/transfers`, `/v1/transfers/claims`,
`/v1/transfers/claims/commit`, and `/v1/transfers/status` with exact-origin
CORS and no-store responses. The bearer is always in a bounded JSON body; it
never appears in a URL. Invalid and unavailable transfer outcomes have the
constant `{state:"unavailable"}` body; rate limiting returns the same body
with 429, and disabled creation returns it with 503.

`TransferHealthDurableObject` stores only non-sensitive health timestamps and a
monthly cost observation. Alarm, watchdog, log, key, and deletion evidence
expires after five minutes. Billing evidence expires after 24 hours, and a
monthly observation at or above 1,000 cents disables new creates. The service
does not treat static `*_HEALTH=healthy` variables as a lease. The checked-in
`ops:health` producer first runs the registry purge, enumerates the fixed
namespace through the official Cloudflare Durable Objects API, invokes the
private object purge endpoint, runs `provider-watchdog-probe.mjs` against a
bounded provider receipt, and submits fresh heartbeat and billing evidence.
Billing remains an explicit current owner receipt because no Cloudflare billing
API is claimed here. The integration test exercises the scheduler's real HTTP
requests and child probe. No public health or heartbeat route is provided.

The source scheduler has fail-closed guards for repeated cursors and repeated
object IDs. The committed health-producer integration currently proves a
complete two-page pass and rejects a full page that ends without a cursor.
Deterministic committed coverage for repeated cursors/object IDs, or an
authenticated staging artifact exercising those cases, remains open; neither
the current integration nor this packet closes that gate. No ephemeral probe
output is treated as durable evidence.

The provider alarm is a deletion backstop, not proof of the live 60-minute
guarantee by itself. Cloudflare documents at-least-once alarm execution and
possible delay; staging needs the independent watchdog, purge health checks,
manual purge path, and create kill switch required by ADR 0013 before any live
guarantee can be claimed. See [RUNBOOK.md](RUNBOOK.md) for the staging
prerequisites and the unclaimed provider-deadline gate.

Production uses the Cloudflare Durable Object `jurisdiction("eu")`
subnamespace for transfer, rate, health, and registry objects. The local
workerd used by the test plugin currently exposes that API but raises
`Jurisdiction restrictions are not implemented in workerd.`; the narrow
fallback in `namespaces.js` keeps SQLite tests runnable. Local tests therefore
prove storage and transitions, not EU placement. The staging proof must use a
real EU-restricted namespace. They also do not prove a provider recovery-image
restore, edge-log redaction, billing receipt, watchdog lag, or minute-60/
minute-75 disposal on Cloudflare. Those owner/environment gates remain open;
see [RUNBOOK.md](RUNBOOK.md).
