# Temporary iOS install transfer is a one-hour encrypted exception

- **Status:** Specification accepted; deployment ⛔ BLOCKED on the owner gate below
- **Contract owner:** Plan 049 (this ADR); implementer Plan 053; promotion
  consumer Plan 054; evidence consumer Plan 059
- **Governing decisions:** G-07, G-39, G-48, G-71, G-84–G-88
- **Companions:** [ADR 0007](0007-shared-setup-links.md) (setup-link proposal,
  a different object), [ADR 0012](0012-ui-overhaul-canonical-reconciliation.md)
  (state ownership)

When iOS Safari already holds Taurifer data, `Install and transfer my data`
creates a real short-lived backend record with a one-time install token. The
installed PWA claims it and atomically imports an exact logical clone, then
the record is deleted. This is an approved narrow exception to the
static/local-first architecture (G-07: local-first does not mean local-only).
It is not an account, synchronization, backup, publishing, or generalized API
platform, and no later plan may widen it without a new owner decision.

Field names, state machines, and transport rules below are identical to Plan
053's; Plan 053 implements them and must not rename them.

## ⛔ Owner gate (open)

The infrastructure provider, region/data residency, datastore, encryption-key
owner, expiry mechanism, alert owner, cost ceiling, incident/kill-switch
authority, and the approved user-facing privacy disclosure are unresolved.
Plan 053 must not implement and Plan 054 must not offer the established-data
transfer until the owner records them here. A Cloudflare Worker plus a durable
strongly consistent store is a suitable shape only if the owner approves it;
do not infer provider authorization from the repository's static hosting.

## Deployment boundary

An isolated `services/install-transfer/` project with its own manifest,
tests, deployment/runbook, and lockfile if the selected provider requires
dependencies. No root package manager, no application dependency. The service
has one purpose and one encrypted record type: it cannot query by
user/installation, list transfers, retain payload history, or become a
general state endpoint. A dependency-free browser module (`install-transfer.js`,
loaded before `app.js`) owns envelope construction/validation, API calls,
handoff-token parsing, claim state, and recovery-snapshot markers; storage
mutation stays in the existing state persistence adapter.

## Logical clone V1

The browser constructs a fresh semantic envelope from parsed current state;
it never uploads `localStorage`/IndexedDB wholesale.

| Field | Type | Meaning |
|---|---|---|
| `kind` | `taurifer-install-transfer` | Envelope discriminator |
| `schemaVersion` | `1` | Clone schema version |
| `createdAt` | timestamp | Creation time |
| `source.context` | `browser` | Creating context |
| `source.logicalInstallationId` | string | Coarse logical installation reference, not a tracking ID |
| `sourceRevision` | integer | Durable revision counter at creation; lets Safari detect post-creation source mutations (not transferred as storage metadata) |
| `durableState` | object | Normalized `repforge_v1` value (program, history, archive, provenance, logical settings) |
| `workoutDraft` | null \| object | DraftV2 logical section, or explicit null when absent |
| `programEntryDraft` | null \| object | Unfinished program-entry candidate as a separately versioned section, or explicit null when absent. DECIDED: included — losing an active build/import draft would violate exact-clone fidelity (G-84). Inclusion changes nothing about activation: the candidate still requires explicit review and activation and is never auto-applied. |
| `uiPreferences` | object | Normalized `repforge_ui_v1` value |
| `analytics.enabled` | boolean | Analytics consent value |
| `telemetryIdentity.schemaVersion` | integer | Identity schema version |
| `telemetryIdentity.installationId` | string | Stable pseudonymous identity (preserved, not rotated) |
| `telemetryIdentity.createdAt` | timestamp | Identity creation time |
| `integrity.canonicalPayloadHash` | string | Digest over the canonical payload; validated in memory before any local write |

Normalization removes `_storageRevision`, `_storageFollowUp`,
`_storageDraftTransaction`, `_storageSetupActivation`, pending/closing sidecar
data, tab/writer/operation IDs, cookies, notification/permission runtime data,
and provider analytics session IDs. Parsing applies explicit field/size/depth
limits and rejects unknown required versions.

### Example envelope (parseable; values illustrative)

```json
{
  "kind": "taurifer-install-transfer",
  "schemaVersion": 1,
  "createdAt": "2026-10-01T09:00:00.000Z",
  "source": { "context": "browser", "logicalInstallationId": "li_7f3a" },
  "sourceRevision": 42,
  "durableState": {
    "program": [{ "dayId": "growth_d1", "label": "Day 1", "slots": [{ "slotId": "growth_d1_s1", "libraryId": "sq_bb", "sets": 4 }] }],
    "programMeta": { "name": "Build Muscle", "onboarded": true },
    "log": [],
    "settings": { "unit": "kg", "lang": "en" }
  },
  "workoutDraft": null,
  "programEntryDraft": null,
  "uiPreferences": { "theme": "system" },
  "analytics": { "enabled": true },
  "telemetryIdentity": { "schemaVersion": 1, "installationId": "ti_9c2e", "createdAt": "2026-08-01T10:00:00.000Z" },
  "integrity": { "canonicalPayloadHash": "9f2c4151ad0e77c3b6d4e5f80918273a4b5c6d7e8f90a1b2c3d4e5f60718293a4" }
}
```

## Server record and endpoints

The bearer token travels in request bodies only, never in a URL path, query
string, fragment, or loggable surface. URL shapes below are exact; an
implementation may not move the token into the path.

1. `POST /v1/transfers` with `{envelope, idempotencyKey}`: validate envelope
   and size, assign `expiresAt <= serverNow + 60 minutes`, encrypt with AEAD
   (per-record nonce, managed key version, schema/creation/expiry as
   associated data), store only a keyed token digest alongside the
   idempotency key, and return the plaintext opaque token plus absolute
   expiry exactly once — on first creation only. A retry carrying a known
   idempotency key while its record is still live returns
   `{duplicate: true, expiresAt}` with NO token: the server cannot reproduce
   a bearer it never stored. The client seals the received token to its
   local outbound marker immediately (see commit credentials), so a crash
   after receipt stays recoverable; a client that never received the token
   starts over with a new key after the orphan expires. One key never yields
   two live records.
2. `POST /v1/transfers/claims` with `{token, claimId}`: atomically bind an
   `available` transfer to the client-generated claim ID (128+ bits) and
   return the clone to that same claim on safe retries. Every other claim ID
   receives a generic unavailable response with uniform invalid/expired/
   claimed shape.
3. `POST /v1/transfers/claims/commit` with `{token, claimId}`: accept the
   bound claim and delete ciphertext immediately. A minimal non-sensitive
   tombstone may retain only token digest, terminal state, and original expiry
   to communicate one-time/recovery status; it contains no clone or identity
   and disappears at expiry.
4. `POST /v1/transfers/status` with `{token}`: return `{state, expiresAt}`
   and nothing else — no clone, no identity. This is how the creating Safari
   learns the outcome (see Safari polling below).
5. Expiry processing: an independent process deletes ciphertext at or before
   60 minutes even when the client never returns. Monitor the oldest live
   record and deletion lag.

Tokens carry at least 256 random bits and are never stored plaintext. Server
states are `available`, `claiming`, `deleted`, `expired`, and
`claimed-expired`; ciphertext exists only in the first two. A `claiming`
record whose commit is never confirmed expires into `claimed-expired` — the
import may have completed — and its tombstone (digest, terminal state,
original expiry, no clone or identity) persists to the original expiry so the
creating Safari can learn it. `expired` strictly means never claimed.

```text
available ──claim──▶ claiming ──commit──▶ deleted
    │                   │
    │                   └──expiry──▶ claimed-expired
    └──expiry──▶ expired
```

Responses use TLS, strict origin/CORS, `Cache-Control: no-store`, no
redirect, bounded bodies, and rate limiting. AEAD tamper failure, unique
nonces, entropy, and key rotation across the maximum lifetime are tested;
structured logs and traces must contain no token, claim ID, ciphertext,
envelope fields, or request body.

## Threat model

Each row names the threat, the controlling mitigation, and where it is
specified. Residual risk is accepted and disclosed, never defined away.

| # | Threat | Control |
|---|---|---|
| T-01 | Token theft, including a bearer observed in static-host access logs before the legitimate claim | 256-bit bearer; digest-only storage; first-claim-wins binding; prompt claiming; ≤60-minute window; `Cookie`-header log redaction requirement. A pre-claim bearer CAN claim the clone — the window is narrowed, not closed |
| T-02 | Brute force against tokens or claim IDs | 256-bit token / 128-bit claim entropy; digest lookup; rate limits; constant-shape failures |
| T-03 | Replay or a second claimant | Atomic `available → claiming → deleted/expired`; bound claim retries only until commit or expiry |
| T-04 | Log, referrer, or trace leakage of bearer, clone, or envelope fields | Ban from logs, analytics, error tracking, referrers, foreign URLs, fixtures, screenshots; sealed local credentials; redacted static-host logs |
| T-05 | Malicious or stale tabs racing create, claim, or resume | Claim-ID binding; source operation lock; validate-before-touch; versioned import marker; cross-tab freeze |
| T-06 | Service or operator access to the clone | Minimal one-hour retention; commit-verified deletion; explicit no-E2EE disclosure; kill switch and purge runbook |
| T-07 | Oversized or malformed payloads and envelopes | Schema/depth/size bounds enforced before and during parsing; unknown required versions fail closed |
| T-08 | Cross-origin requests | Exact-origin CORS; content-type enforcement; no redirects |
| T-09 | Interrupted create, claim, import, or commit | Same-key create dedupe; same-claim retry; two-sided sealed markers; boot finish-or-restore; idempotent remote commit retry |
| T-10 | Clock skew between client, server, and expiry job | Absolute server-issued expiry; skew-tolerant acceptance window documented by the implementer; server clock owns expiry |
| T-11 | Expiration backlog or purge failure | Expiry-job monitoring with deletion-latency bounds; alarm and kill switch; manual purge runbook; no new creates until retention is healthy |
| T-12 | Encryption-key compromise or rotation gap | Managed rotation; old keys retained only through the maximum live-record window; creation disabled rather than serving undecryptable data |
| T-13 | Sealed commit-credential loss (key wiped, profile reset) | Unrecoverable by design; 60-minute expiry plus purge backstop; local data never at risk; fresh-transfer user guidance |
| T-14 | Status-polling oracle or unknown-outcome confusion | Status returns state plus expiry only, to the bearer holder alone; unknown-outcome state with safe browser-continue default after expiry plus margin |

## iOS handoff cookie

Phase 049 selects the handoff key: **`repforge_transfer_v1`**.
Historical-codename-compatible, distinct from `repforge_setup_v1`, which it
never overloads — a setup proposal and a full-state transfer may coexist and
are disambiguated deterministically. The cookie carries only the opaque token
and expiry, never the clone: matching `index.html` path, short lifetime,
`SameSite=Lax`, and `Secure` outside localhost. The installed context
consumes and expires its transfer cookie before ordinary boot writes state.
Token values never enter fragment/history, DOM text, telemetry, console,
service-worker cache keys, or screenshots.

### The static host necessarily receives the cookie

The matching static host gets the token in the `Cookie` request header, and
ordinary access logs record request headers. This is accepted with layered
controls, stated here so no later document can soften it:

- The logged value is useful only before the legitimate claim: the first
  claim ID to bind wins, the installed client claims within seconds of
  install, and the record dies on verified-import commit or within one hour. It is NOT true
  that a logged token is harmless: anyone holding an unclaimed bearer can
  claim and retrieve the clone before the legitimate client does. The
  controls below narrow that window; they do not close it, and the residual
  risk is accepted and disclosed rather than defined away.
- Processor trust is explicit: the static-host operator (token header, timing)
  and the transfer operator (encrypted clone, claim behavior) can each
  observe what they handle. Do not claim end-to-end encryption unless the
  server truly cannot decrypt.
- Operational requirement (part of the owner gate): static-host access logs
  covering transfer-period requests must have a bounded retention with
  `Cookie` values stripped or redacted, plus a manual purge runbook. No new
  transfer creation until log retention is healthy.
- The user-facing disclosure names the temporary copy, its one-hour life,
  commit-verified deletion, token-cookie transport including static-host
  receipt, Safari retention, and recovery/divergence behavior.

## Atomic local import

A versioned `repforge_install_import_v1` transaction marker travels the
existing durable write path:

```text
transactionId, claimIdDigest, phase
previous: validated logical local clone
incoming: validated logical clone
createdAt, expectedLocalRevision
```

1. Before app initialization exposes mutable UI, read the handoff token,
   stage the `repforge_transfer_inbound_v1` marker with the sealed token and
   a stable client-generated claim ID, then claim.
2. Validate all envelope sections and the canonical hash in memory.
3. Acquire the cross-tab state/draft/import lock; freeze other tabs via
   BroadcastChannel/storage signaling.
4. Stage the marker with complete previous and incoming snapshots.
5. Write normalized durable state through the existing mirror/WAL path,
   write or remove DraftV2 and the candidate draft, then
   preferences/consent/identity.
6. Re-read and validate every section and identity; set marker
   `local-committed`.
7. Release into installed boot, call remote commit/delete, then clear the
   marker after confirmed or retryable deletion bookkeeping.

On boot, an incomplete marker either finishes the entire incoming import if
the committed sections and hash prove safe, or restores the entire previous
snapshot. Mixed state is never exposed. Failure before local commit leaves current
installed state unchanged. If the installed context already holds meaningful
local state, stop and require explicit choice; never overwrite automatically.
Client states: `idle`, `creating`, `ready`, `claiming`, `validating`,
`importing`, `localCommitted`, `deletingRemote`, `complete`, `retryable`,
`terminalUnavailable`.

### Commit credentials (crash-safe remote deletion on both sides)

Remote commit needs the plaintext token and claim ID, but each side keeps
only digests in its durable markers — so a crash after local commit (or
after claim binding) would strand the ciphertext with no retry path. Each
storage context therefore seals its own credentials locally; the Safari
outbound marker and the installed inbound marker never cross contexts:

- At creation, the Safari side writes a single local-only
  `repforge_transfer_outbound_v1` marker: `{idempotencyKey, sealedToken,
  tokenDigest, createdAt, expiresAt, sourceRevision, mutatedAfterCreation,
  phase}`. Safari never learns the installed app's claim ID and never needs
  it: creation retry uses the idempotency key, outcome polling uses the
  token. There is no second Safari-side marker.
- `sourceRevision` captures the durable revision counter at creation, and
  creation takes the source operation lock so two Safari tabs cannot mint
  competing transfers. Any local mutation after creation sets
  `mutatedAfterCreation`, which the success messaging surfaces (see
  recovery).
- On receiving the token and BEFORE sending the claim request, the installed
  side writes a local-only `repforge_transfer_inbound_v1` marker:
  `{sealedToken, sealedClaimId, expiresAt, phase}` with phase starting at
  `staged`, advancing to `claiming` when the request is sent, then
  `local-committed` and finally `delete-confirmed`.
  A crash after claim binding resumes the same claim ID from this marker; a
  crash after local commit retries the remote commit from it.
- Sealing uses device-local WebCrypto AES-GCM under a non-extractable device
  key held in that context's IndexedDB outside backup scope. Plaintext
  credentials never touch logs, backup, telemetry, or the DOM.
- After the remote commit is confirmed, the completing side wipes its marker
  and the device key material for that transfer.
- If unsealing fails (key lost, profile reset), the credential is
  unrecoverable by design: the record dies at its 60-minute expiry (plus the
  purge runbook as backstop), local data was never at risk, and the user
  starts a fresh transfer. This fallback is documented in the user-facing
  failure copy.
- Markers are excluded from backup export/import exactly like token and
  import markers (Plan 053), and are wiped no later than expiry plus an
  operational margin.

## Browser recovery snapshot

Safari retains its original data. It learns the outcome by polling, never by
a shared channel (none exists across the Safari/installed storage boundary):

1. At creation Safari writes the outbound marker above and keeps the token
   in memory (own cookie as fallback while it lives).
2. After handing off to installation, Safari polls `POST
   /v1/transfers/status` with the token, backing off from 5 seconds to 60
   seconds, until a terminal state or `expiresAt` plus a 10-minute margin.
3. On `deleted`, Safari stores the recovery-snapshot marker (tied to token
   digest and time) and freezes mutating UI: a message directs the user to
   the installed app, plus read/recovery/backup access. If
   `mutatedAfterCreation` is set, the message adds that the source changed
   after sending and the installed copy may be stale.
4. On `claimed-expired` — a claim was bound but the commit was never
   confirmed, so the import MAY have completed — Safari must NOT silently
   resume. It freezes exactly as in (3), with copy stating the transfer may
   have completed and directing the user to the installed app. This is the
   divergence case G-88 governs: two active copies are possible, and only an
   explicit divergence warning may resume browser use.
5. On `expired` with no claim ever bound, Safari clears the outbound marker
   and resumes normal use — the transfer never completed and nothing local
   ever changed. This is the only silent-resume path.
6. If Safari restarts with an outbound marker but no token (memory lost,
   cookie consumed or expired), it cannot authenticate status: it shows an
   unknown-outcome state (check the installed app; the transfer window and
   its expiry are shown). After expiry plus margin with no evidence, the user
   may dismiss the marker and keep using the browser — the safe default,
   since local data was never deleted or overwritten.

`Resume in browser` presents an explicit divergence warning — future browser
and installed changes will not merge — and confirmation removes the freeze
only in Safari while recording accepted divergence. Recovery snapshot states:
`none`, `awaitingClaimOutcome`, `confirmed`, `resumeWarning`,
`resumedDiverged`. There is no mechanism that writes installed changes back
to Safari.

## Telemetry

Emit `late_install_transfer` only after verified local import and according
to transferred consent. Approved properties: coarse outcome (`success` for
this event; separate coarse failure counters need Phase 049 approval),
`source_context: browser`, `destination_context: standalone`, platform
family, and schema version. Preserve `installationId`; never generate a
second identity before event initialization. Never emit the token, claim ID,
timestamps precise enough to correlate service records, payload
size/content, program identity, or readiness data.

## Privacy disclosure checklist

Privacy copy must say what is temporarily copied, why, who processes it
(static host sees the token header; the transfer service processes the
encrypted clone), encryption in transit and at rest, one-time claim,
commit-verified or one-hour deletion, token-cookie transport, Safari status polling,
sealed local commit credentials and their wipe rules, original Safari
retention, recovery-snapshot/divergence behavior, and how telemetry
identity/consent carry over. It must state the residual pre-claim token
theft window honestly. No payload or token appears in logs, error
tracking, analytics, URLs, clipboard by default, catalog fixtures, or
support screenshots.

## Operations

The implementer documents expiry-job monitoring, deletion latency, key
rotation, incident handling, cost and retention bounds, and a feature kill
switch that removes the promotion and the action without stranding local
data. A service outage never blocks ordinary browser use, setup links,
backups, or manual installation. Service-worker fetch handlers never cache
transfer requests or responses.

## Specified UI states (no visual design)

Transfer: unavailable, eligible, creating, ready-to-install, claiming,
importing, success/recovery-snapshot, invalid, expired, already-claimed,
interrupted/retryable, service-disabled, divergence-warning. Recovery-week
states live in `docs/recovery-week-policy.md`. Plans must never claim that
installation is required for offline use or that it supplies native-grade
reminders or storage durability.
