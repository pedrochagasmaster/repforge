# Install-transfer service foundation

This directory is the isolated Plan 053 P2a foundation. It has its own
Wrangler configuration and test dependencies; the root static app does not
depend on it yet.

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
state. It does not store raw idempotency keys, claim IDs, bearer strings, or
plaintext clone data. A committed tombstone clears the ciphertext and claim
digest but retains only the keyed token digest, terminal state, and original
expiry until the 15-minute tombstone margin.

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
npm test
```

The HTTP transport deliberately returns unavailable for transfer paths until
the corrected shared envelope module is accepted. Raw request-byte parsing,
endpoint validation, strict CORS/origin handling, rate limits, and the full
create/claim/commit/status response adapter belong to the next slice and must
use that accepted module instead of duplicating its validators here.

The provider alarm is a deletion backstop, not proof of the live 60-minute
guarantee by itself. Cloudflare documents at-least-once alarm execution and
possible delay; staging needs the independent watchdog, purge health checks,
manual purge path, and create kill switch required by ADR 0013 before any live
guarantee can be claimed.
