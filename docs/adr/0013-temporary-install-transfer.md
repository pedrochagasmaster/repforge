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
| `durableState` | object | Normalized `repforge_v1` value (program, history, archive, provenance, logical settings) |
| `workoutDraft` | null \| object | DraftV2 logical section, or explicit null when absent |
| `programEntryDraft` | null \| object | Versioned candidate section per the Plan 049 disposition (default: included as its own versioned section, retaining its no-program-persistence boundary), or explicit null |
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

1. `POST /v1/transfers` with `{envelope}`: validate envelope and size, assign
   `expiresAt <= serverNow + 60 minutes`, encrypt with AEAD (per-record nonce,
   managed key version, schema/creation/expiry as associated data), store only
   a keyed token digest, and return the plaintext opaque token plus absolute
   expiry exactly once. Create retries use an idempotency key so a timeout
   cannot produce multiple live clones.
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
4. Expiry processing: an independent process deletes ciphertext at or before
   60 minutes even when the client never returns. Monitor the oldest live
   record and deletion lag.

Tokens carry at least 256 random bits and are never stored plaintext. Server
states are `available`, `claiming`, `deleted`, `expired`; ciphertext exists
only in the first two:

```text
available ──claim──▶ claiming ──commit──▶ deleted
    │                   │
    └──expiry──▶ expired ◀──expiry──┘
```

Responses use TLS, strict origin/CORS, `Cache-Control: no-store`, no
redirect, bounded bodies, and rate limiting. AEAD tamper failure, unique
nonces, entropy, and key rotation across the maximum lifetime are tested;
structured logs and traces must contain no token, claim ID, ciphertext,
envelope fields, or request body.

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
  install, and the record dies on claim or within one hour.
- The token alone never exposes the clone; the clone lives only in the
  transfer service ciphertext, never on the static host.
- Processor trust is explicit: the static-host operator and the transfer
  operator can each observe what they handle. Do not claim end-to-end
  encryption unless the server truly cannot decrypt.
- Operational requirement (part of the owner gate): static-host access logs
  covering transfer-period requests must have a bounded retention with
  `Cookie` values stripped or redacted, plus a manual purge runbook. No new
  transfer creation until log retention is healthy.
- The user-facing disclosure names the temporary copy, its one-hour life,
  immediate claim deletion, token-cookie transport including static-host
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

1. Before app initialization exposes mutable UI, claim with a stable
   client-generated claim ID.
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
snapshot. Mixed state is never exposed. Remote commit retries idempotently
after a locally committed import. Failure before local commit leaves current
installed state unchanged. If the installed context already holds meaningful
local state, stop and require explicit choice; never overwrite automatically.
Client states: `idle`, `creating`, `ready`, `claiming`, `validating`,
`importing`, `localCommitted`, `deletingRemote`, `complete`, `retryable`,
`terminalUnavailable`.

## Browser recovery snapshot

Safari retains its original data. After installed success, a non-sensitive
success acknowledgement/tombstone or same-origin channel lets Safari store a
local recovery-snapshot marker tied to token digest and time. While marked,
normal mutating UI is replaced by a message directing the user to the
installed app, plus read/recovery/backup access. `Resume in browser`
presents an explicit divergence warning — future browser and installed
changes will not merge — and confirmation removes the freeze only in Safari
while recording accepted divergence. Recovery snapshot states: `none`,
`awaitingClaimOutcome`, `confirmed`, `resumeWarning`, `resumedDiverged`.
There is no mechanism that writes installed changes back to Safari.

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
immediate/one-hour deletion, token-cookie transport, original Safari
retention, recovery-snapshot/divergence behavior, and how telemetry
identity/consent carry over. No payload or token appears in logs, error
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
