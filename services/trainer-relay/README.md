# Trainer relay

The seven-day encrypted relay of [ADR 0026](../../docs/adr/0026-trainer-loop-relay-and-trainer-site.md),
built as [Plan 086](../../plans/086-trainer-loop.md) slice 1. A program handoff
or a training update is encrypted on the sender's device, stored here as
ciphertext for at most seven days, and read with a short link whose fragment
holds the key. Nothing in the app calls it yet: slice 1 has no UI.

| Part | Owner |
| --- | --- |
| Endpoints, limits, request and record shapes, link format | [`trainer-relay-contract.js`](../../trainer-relay-contract.js) (shared by the Worker and the browser) |
| Browser client: compress, encrypt, upload; read, decrypt, decompress | [`trainer-relay.js`](../../trainer-relay.js) |
| Worker and its three Durable Objects | `src/` |
| The five slice-1 proofs against a local relay | `test/relay-proofs.test.mjs` |
| The same proofs against the deployed staging relay | `scripts/staging-proofs.mjs` |

## Contract

- **Encryption is on the device.** The client gzips the UTF-8 document,
  encrypts it with a fresh 256-bit AES-GCM key and a 96-bit random nonce
  (additional data `taurifer/trainer-relay/v1\0` + protocol version), and
  uploads `{ v: 1, nonce, ciphertext }` as unpadded base64url. The key never
  leaves the device except inside the link.
- **Link:** `<page>#r=<22-character record id>.<43-character key>`. The app's
  link is 90 characters and the trainer site's 97; both encode as a version 6
  QR code (41×41 modules) at error correction M.
- **Endpoints** (POST, JSON, allowed origins only, no query string):
  `/v1/relay/records` creates and returns `{ id, expiresAt }`;
  `/v1/relay/records/read` takes `{ v: 1, id }` and returns
  `{ v, nonce, ciphertext, expiresAt }`. Reads put the id in the body so it
  never appears in a URL or an access log.
- **Lifetime:** the service assigns the expiry, seven days after creation.
  `RELAY_RECORD_LIFETIME_SECONDS` can shorten it (minimum 60 s), never lengthen
  it. A record can be read any number of times before it expires; a read at or
  after the expiry fails and deletes it, and an alarm at the expiry deletes it
  otherwise.
- **Storage:** one Durable Object per record, in the EU jurisdiction, holding
  ciphertext, nonce, version, creation time, expiry and size. Objects are named
  by an HMAC of the record id, so object names and a storage image hold no id.
  No address, name, account or device identifier is stored; rate buckets hold
  an HMAC of the address and delete themselves after their window.

## Limits and abuse

| Limit | Value | Response |
| --- | --- | --- |
| Ciphertext per record | 262,144 bytes (the client refuses larger before uploading) | 413 |
| Create body | 350,000 bytes | 413 |
| Creates per address | 300 per hour (ADR 0026 amendment, 2026-11-26) | 429 |
| Reads per address | 120 per minute | 429 |
| Operating cost | 1,000 cents ($10) per UTC month (owner, 2026-11-26) | 503 on create; reads continue |
| Kill switch | `RELAY_KILL_SWITCH=true` or `RELAY_CREATES_ENABLED` not `true` | 503 on create; reads continue |

**Cost gate.** `RelayMeterDurableObject` keeps this month's counts and two
figures: a metered estimate charged on every create (per request and per
stored byte for seven days) and read, at the list prices in `src/meter-do.js`
with no free allowance; and the latest owner-attested figure for the month,
posted to `/_ops/billing` as install transfer's billing receipt is. Creates
are refused while the larger is at or above the threshold. Unlike install
transfer, a missing or old receipt does not close the gate, because the
metered estimate always exists; see "Interpretations" in the slice-1 PR.

**Alert.** The first refusal in a month writes one fixed log line (no request
data) to Workers Logs and, when `RELAY_ALERT_GITHUB_TOKEN` and
`RELAY_ALERT_REPO` are set, opens one GitHub issue. Neither secret is
provisioned on staging.

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `RELAY_ALLOWED_ORIGINS` | var | Comma-separated origins allowed to call the relay |
| `RELAY_CREATES_ENABLED`, `RELAY_KILL_SWITCH` | var | Create gate |
| `RELAY_RECORD_LIFETIME_SECONDS` | var, optional | Shorter lifetime for proofs |
| `RELAY_ROUTING_KEY_B64`, `RELAY_RATE_PEPPER_B64` | secret, ≥ 32 bytes base64url | HMAC keys for object names and rate buckets |
| `RELAY_OPS_SECRET` | secret, ≥ 32 chars | Bearer for `/_ops/health` and `/_ops/billing` |
| `RELAY_ALERT_GITHUB_TOKEN`, `RELAY_ALERT_REPO` | secret and var, optional | Cost alert issue |

`wrangler.jsonc` defines the local Worker, a `staging` environment
(`taurifer-trainer-relay-staging` on workers.dev, no route) and a `production`
environment (`taurifer-trainer-relay` on the custom domain
`relay.taurifer.com`, creates off). Production is prepared, not deployed: the
owner approves the first deploy. `test/production-config.test.mjs` pins it.
Invocation logs are off; request bodies and URLs are never logged.

## Commands

```sh
npm ci
npm test                    # the five proofs against a local relay (Miniflare)
npm run deploy:dry:staging  # bundle check, no upload
```

Staging, owner-account `wrangler` session required. Keep the secrets file in
a private 0700 directory outside the repository; never print it.

```sh
npx wrangler deploy --env staging
npx wrangler secret bulk <private secrets.json> --env staging
RELAY_STAGING_URL=<staging origin> RELAY_STAGING_ENV=<private env file> node scripts/staging-proofs.mjs main
npx wrangler deploy --env staging --var RELAY_RECORD_LIFETIME_SECONDS:60   # then: … staging-proofs.mjs expiry
npx wrangler deploy --env staging                                          # then: … staging-proofs.mjs kill-before
npx wrangler deploy --env staging --var RELAY_KILL_SWITCH:true             # then: … staging-proofs.mjs kill-after
npx wrangler deploy --env staging                                          # then: … staging-proofs.mjs rate
```

The script prints counts, lengths and outcomes, never a key, link, record id
or payload.

Production (ADR 0026, second amendment). Each step waits for the owner's
approval; none has been run.

```sh
npm run deploy:dry:production                            # bundle check, no upload
npx wrangler deploy --env production                     # creates relay.taurifer.com (DNS record and certificate)
npx wrangler secret bulk <private secrets.json> --env production   # RELAY_ROUTING_KEY_B64, RELAY_RATE_PEPPER_B64, RELAY_OPS_SECRET
curl -fsS -H "Authorization: Bearer <ops secret>" https://relay.taurifer.com/_ops/health
```

Generate production secrets fresh; never reuse staging's. Creates stay off
(`RELAY_CREATES_ENABLED: "false"`) until slice 2 merges and the owner approves
turning them on. The cost alert opens an issue only once
`RELAY_ALERT_GITHUB_TOKEN` and `RELAY_ALERT_REPO` are set.

## The two documents

[`trainer-documents.js`](../../trainer-documents.js) owns the two payloads of
ADR 0026 (Plan 086 slices 2 and 4, no UI). Both are new versioned kinds, so the
locked shared-setup document and its `v4.`/`v5.` envelopes are unchanged. An
unknown kind, a newer version or an unknown field is refused whole.

| | Program handoff | Training update |
| --- | --- | --- |
| Kind, version | `taurifer-program-handoff`, 1 | `taurifer-training-update`, 1 |
| Carries | the program (name, canonical definition, referenced custom exercises), the eight allowlisted settings and language, starting loads (`{ slotId, openingKg }` per training slot), an optional message (≤ 1,000 chars), trainer attribution (`displayName`, optional `registration`) | the current program, and the sessions completed under it (`row.blockId === programMeta.blockId`) after the last update sent: date, day, completion time, session notes, and per set the exercise, name, load, reps, RIR, effort source, partial reps, warm-up or ramp flag, exercise note and metric values |
| Never carries | anything about another client | earlier programs' sessions, sessions already sent, suggested warm-ups, body weight (rows' `bodyweight` and `loadingContext`), settings, profile, device preferences, calibration and starting-load records |
| Validation | program, settings and language through `shared-setup.js`'s own validator; starting loads must name training slots | the program as for the handoff; each set's exercise must be a catalog movement or a custom exercise the update carries |
| Bound | 1 MiB of JSON | 1 MiB of JSON and at most 120 sessions |

The update is built field by field from saved log rows. It never copies a
row, so a field missing from its allowlist cannot reach the document.
`test/documents.test.mjs` proves this against rows carrying sentinel values in
every excluded place, including 200 rows with random extra fields.

Measured on the four-day, seven-week program with realistic logs (one session
per training day, 37 sets a week, Portuguese session and exercise notes, body
weight on every session):

| Update | Sessions | Sets | JSON | gzip |
| --- | --- | --- | --- | --- |
| Program alone | — | — | 119,610 B | 7,835 B |
| 1 week | 4 | 37 | 135,535 B | 9,398 B |
| 3 weeks | 12 | 111 | 167,721 B | 10,904 B |
| 7 weeks (the whole block) | 28 | 259 | 231,744 B | 13,512 B |
| 30 weeks (the session cap) | 120 | 1,110 | 601,125 B | 28,188 B |
