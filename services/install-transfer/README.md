# Install-transfer service

This directory is the isolated Plan 053 service. It has its own Wrangler
configuration, lockfile, and test dependencies; the root static app does not
depend on it.

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
```

Claim and commit transitions use conditional SQLite updates keyed by the
expected state, token digest, and expiry. The local Workers runtime tests
exercise concurrent creates, first-claim binding, same-claim retries, and
idempotent concurrent commits, as well as metadata and AAD tamper rejection.
The authenticated operations runbook can invoke `purgeDue({now})` on a routed
object stub as a manual backstop; it never lists objects or accepts a bearer in
a URL. A corrupt active record is deleted by its singleton key, its object
re-arms a short bounded alarm, and the global health object disables new
creates. Creates remain disabled unless configuration, deletion, alarm,
watchdog, key, log, billing, and fresh health-lease evidence are all healthy
and the operator enables them; the kill switch forces them off. Claims, status,
commit, and purge do not use this create gate.

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
does not treat static `*_HEALTH=healthy` variables as a lease. An owner
controlled watchdog or control-plane job must call the health object's RPC
methods with fresh evidence and must re-enable deletion health only after the
runbook has proved the purge path. No public heartbeat route is provided.

The provider alarm is a deletion backstop, not proof of the live 60-minute
guarantee by itself. Cloudflare documents at-least-once alarm execution and
possible delay; staging needs the independent watchdog, purge health checks,
manual purge path, and create kill switch required by ADR 0013 before any live
guarantee can be claimed. See [RUNBOOK.md](RUNBOOK.md) for the staging
prerequisites and the unclaimed provider-deadline gate.

Production uses the Cloudflare Durable Object `jurisdiction("eu")`
subnamespace for transfer, rate, and health objects. The local workerd used by
the test plugin currently exposes that API but raises
`Jurisdiction restrictions are not implemented in workerd.`; the narrow
fallback in `namespaces.js` keeps SQLite tests runnable. Local tests therefore
prove storage and transitions, not EU placement. The staging proof must use a
real EU-restricted namespace.
